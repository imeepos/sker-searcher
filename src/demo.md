```ts
import { useEntityManagerTransaction, useEntityManager } from '@sker/orm';
import { z } from "zod";
import { requestWithRule, lastValueFrom, retry } from '@sker/axios'
import { AiProject } from '../project/project.js';
import { PlanStatus, PlanPriority } from './types.js'
import { PlanDependency } from './PlanDependency.js'
import { Plan } from './AiPlan.js'
import { PlanLog } from './PlanLog.js'

export const PlanRule = z.array(z.object({
    id: z.string({ description: '任务唯一标识（必填）, 格式@xxx/xxx 要求：高可读性' }),
    name: z.string({ description: '任务名称（必填）' }),
    description: z.string({ description: '任务详细说明（必填）' }),
    priority: z.enum(['low', 'medium', 'high', 'critical'], {
        description: '任务优先级：低（low）、中（medium）、高（high）、紧急（critical）'
    }),
    dependencies: z.array(z.string(), {
        description: '依赖的任务ID列表，表示当前任务执行前需完成的任务，请务必保证依赖的任务ID是存在的'
    }),
})).min(1);

export type PlanRuleType = z.infer<typeof PlanRule>

export interface Task {
    id: string;
    name: string;
    description?: string;
    status: PlanStatus;
    priority: PlanPriority;
    dependencies: string[];
    startTime?: Date;
    endTime?: Date;
    projectId?: number;
}

// 添加更严格的类型
export type MetaPlan = Plan & { isMeta: true };
export type ParentPlan = Plan & { children: Plan[] };

// 添加类型守卫
export function isMetaPlan(plan: Plan): plan is MetaPlan {
    return plan.isMeta === true;
}

export interface PlanningFlowOptions {
    maxConcurrentTasks?: number;
    onTaskStart?: (task: Task) => void;
    onTaskComplete?: (task: Task) => void;
    onTaskFail?: (task: Task, error: Error) => void;
}


export class PlanningFlow {
    private maxConcurrentTasks: number;
    private onTaskStart: (task: Task) => void;
    private onTaskComplete: (task: Task) => void;
    private onTaskFail: (task: Task, error: Error) => void;

    constructor(options: PlanningFlowOptions) {
        this.maxConcurrentTasks = options.maxConcurrentTasks || 5;
        this.onTaskStart = options.onTaskStart || (() => { });
        this.onTaskComplete = options.onTaskComplete || (() => { });
        this.onTaskFail = options.onTaskFail || (() => { });
    }

    /**
     * 添加任务到数据库
     */
    async addTask(task: Omit<Task, 'status' | 'dependencies'> & { dependencies?: string[], projectId?: number }): Promise<void> {
        return await useEntityManagerTransaction([Plan, PlanDependency], async m => {
            // 插入任务
            await m.save(Plan, {
                id: task.id,
                name: task.name,
                description: task.description,
                priority: task.priority,
                status: 'pending',
                projectId: task.projectId || 0
            });

            // 插入依赖关系
            if (task.dependencies && task.dependencies.length > 0) {
                const dependencies = task.dependencies.map(depId => ({
                    taskId: task.id,
                    dependsOnId: depId,
                    projectId: task.projectId || 0
                }));

                await m
                    .createQueryBuilder()
                    .insert()
                    .into(PlanDependency)
                    .values(dependencies)
                    .orIgnore()
                    .execute();
            }
        });
    }

    async addTasks(tasks: Omit<Task, 'status'>[], projectId: number) {
        return await useEntityManagerTransaction([Plan, PlanDependency], async m => {
            // 插入任务
            const plans = tasks.map(t => m.create(Plan, {
                ...t,
                projectId: projectId
            }))
            if (plans.length > 0) {
                await m.save(Plan, plans);
                const dependencies = plans.map((plan, index) => {
                    const task = tasks[index];
                    const dependencies = task.dependencies.map(depId => {
                        return m.create(PlanDependency, {
                            taskId: task.id,
                            dependsOnId: depId,
                            projectId: task.projectId || projectId
                        })
                    });
                    return dependencies;
                }).flat()
                await m.save(PlanDependency, dependencies)
            }
        });
    }

    /**
     * 获取所有任务
     */
    async getTasks(): Promise<Task[]> {
        return await useEntityManager([Plan, PlanDependency], async m => {
            const tasks = await m.find(Plan);
            const taskDependencies = await m.find(PlanDependency);

            const dependencyMap = new Map<string, string[]>();
            taskDependencies.forEach(dep => {
                if (!dependencyMap.has(dep.taskId)) {
                    dependencyMap.set(dep.taskId, []);
                }
                dependencyMap.get(dep.taskId)!.push(dep.dependsOnId);
            });

            return tasks.map(task => ({
                id: task.id,
                name: task.name,
                description: task.description,
                status: task.status,
                priority: task.priority,
                dependencies: dependencyMap.get(task.id) || [],
                startTime: task.startTime,
                endTime: task.endTime,
                projectId: task.projectId
            }));
        });
    }

    /**
     * 获取特定任务
     */
    async getTask(id: string): Promise<Task | undefined> {
        return await useEntityManager([Plan, PlanDependency], async m => {
            const task = await m.findOne(Plan, { where: { id } });
            if (!task) return undefined;

            const dependencies = await m.find(PlanDependency, {
                where: { taskId: id },
                select: ['dependsOnId']
            });

            const children = await m.find(Plan, {
                where: { parentId: task.pid }
            });

            return {
                id: task.id,
                name: task.name,
                description: task.description,
                status: task.status,
                priority: task.priority,
                dependencies: dependencies.map(d => d.dependsOnId),
                startTime: task.startTime,
                endTime: task.endTime,
                projectId: task.projectId,
                children: await Promise.all(children.map(c => this.getTask(c.id)))
            };
        });
    }

    private async updateParentPlanStatus(taskId: string): Promise<void> {
        return await useEntityManagerTransaction([Plan], async m => {
            const task = await m.findOne(Plan, { where: { id: taskId } });
            if (!task || !task.parentId) return;

            const parent = await m.findOne(Plan, { where: { pid: task.parentId } });
            if (!parent) return;

            // 检查所有子任务是否完成
            const children = await m.find(Plan, {
                where: { parentId: parent.pid }
            });

            const allCompleted = children.every(child =>
                child.status === 'completed'
            );

            if (allCompleted) {
                // TODO: 生成工作总结
                parent.status = 'completed';
                parent.endTime = new Date();
                await m.save(parent);
                // 递归更新上级计划
                await this.updateParentPlanStatus(parent.id);
            }
        });
    }

    async refineTask(task: Plan): Promise<Omit<Task, 'status'>[]> {
        // 实现AI细化任务的逻辑
        console.log(`实现AI细化任务的逻辑:${task.id}`)
        // 返回细化后的子任务数组
        throw new Error(`refineTask`)
    }

    async executeMetaTask(task: Plan) {
        console.log(`执行任务:${task.id}`)
        throw new Error(`执行失败`)
    }

    /**
     * 执行任务
     */
    async executeTask(taskId: string): Promise<void> {
        return await useEntityManagerTransaction([Plan, PlanLog], async m => {
            try {
                // 获取任务
                const task = await m.findOne(Plan, { where: { id: taskId } });
                if (!task) return;

                // 更新任务状态为进行中
                task.status = 'in-progress';
                task.startTime = new Date();
                await m.save(task);
                const dependencies = await this.getTaskDependencies(task.id);
                // 记录日志
                await m.save(PlanLog, {
                    taskId: task.id,
                    status: 'in-progress',
                    message: 'Task started'
                });
                this.onTaskStart({
                    id: task.id,
                    name: task.name,
                    description: task.description,
                    status: task.status,
                    priority: task.priority,
                    dependencies,
                    startTime: task.startTime,
                    projectId: task.projectId
                });

                if (task.isMeta) {
                    // 元计划直接执行
                    await this.executeMetaTask(task);
                } else {
                    // 非元计划需要细化
                    const refinedTasks = await this.refineTask(task);
                    await this.addTasks(refinedTasks, task.projectId);
                }
                // 3. 标记完成
                task.status = 'completed';
                task.endTime = new Date();
                await m.save(task);
                await this.updateParentPlanStatus(task.id);

                // 记录日志
                await m.save(PlanLog, {
                    taskId: task.id,
                    status: 'completed',
                    message: 'Task completed successfully'
                });

                this.onTaskComplete({
                    id: task.id,
                    name: task.name,
                    description: task.description,
                    status: task.status,
                    priority: task.priority,
                    dependencies,
                    startTime: task.startTime,
                    endTime: task.endTime,
                    projectId: task.projectId
                });
            } catch (error) {
                // 更新任务状态为失败
                await m.update(Plan, taskId, {
                    status: 'failed',
                    endTime: new Date()
                });

                // 记录日志
                await m.save(PlanLog, {
                    taskId,
                    status: 'failed',
                    message: (error as Error).message
                });

                const task = await this.getTask(taskId);
                if (task) {
                    this.onTaskFail(task, error as Error);
                }
                throw error;
            }
        });
    }
    /**
     * 获取任务依赖
     */
    async getTaskDependencies(taskId: string): Promise<string[]> {
        return await useEntityManager([PlanDependency], async m => {
            const deps = await m.find(PlanDependency, {
                where: { taskId },
                select: ['dependsOnId']
            });
            return deps.map(d => d.dependsOnId);
        });
    }

    /**
     * 启动任务流执行
     */
    async start(projectId?: number): Promise<void> {
        while (await this.hasPendingTasks(projectId)) {
            // 获取所有可执行的任务（pending状态且依赖已完成）
            const executableTasks = await useEntityManager([Plan, PlanDependency], async m => {
                const query = m
                    .createQueryBuilder(Plan, 'task')
                    .leftJoin(PlanDependency, 'dependency', 'dependency.taskId = task.id')
                    .leftJoin(Plan, 'depTask', 'dependency.dependsOnId = depTask.id')
                    .where('task.status = :pending', { pending: 'pending' })
                    .andWhere(qb => {
                        const subQuery = qb.subQuery()
                            .select('COUNT(1)')
                            .from(PlanDependency, 'dep')
                            .innerJoin(Plan, 'dt', 'dep.dependsOnId = dt.id')
                            .where('dep.taskId = task.id')
                            .andWhere('dt.status != :completed', { completed: 'completed' })
                            .getQuery();
                        return `(${subQuery}) = 0`;
                    });

                // 如果指定了projectId，只查询该项目的任务
                if (projectId !== undefined) {
                    query.andWhere('task.projectId = :projectId', { projectId });
                }

                return await query
                    .orderBy(`
                        CASE task.priority
                            WHEN 'critical' THEN 0
                            WHEN 'high' THEN 1
                            WHEN 'medium' THEN 2
                            WHEN 'low' THEN 3
                        END`, 'ASC')
                    .addOrderBy('task.name', 'ASC')
                    .getMany();
            });
            // 获取当前正在执行的任务数
            const activeTasksCount = await useEntityManager([Plan], async m => {
                const query = m.createQueryBuilder(Plan, 'task')
                    .where('task.status = :inProgress', { inProgress: 'in_progress' });

                // 如果指定了projectId，只统计该项目的任务
                if (projectId !== undefined) {
                    query.andWhere('task.projectId = :projectId', { projectId });
                }

                return await query.getCount();
            });

            const availableSlots = this.maxConcurrentTasks - activeTasksCount;

            // 执行任务（不超过并发限制）
            const tasksToExecute = executableTasks.slice(0, availableSlots);
            await Promise.all(tasksToExecute.map(task => this.executeTask(task.id)));

            // 如果没有可执行任务，稍作等待
            if (tasksToExecute.length === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    }

    /**
     * 检查是否有待处理的任务
     */
    async hasPendingTasks(projectId?: number): Promise<boolean> {
        return await useEntityManager([Plan], async m => {
            const query = m
                .createQueryBuilder(Plan, 'task')
                .where('task.status IN (:...statuses)', {
                    statuses: ['pending', 'in_progress']
                });

            // 如果指定了projectId，只查询该项目的任务
            if (projectId !== undefined) {
                query.andWhere('task.projectId = :projectId', { projectId });
            }

            const count = await query.getCount();
            return count > 0;
        });
    }
}

export class PlanningReActAgent {
    // 计划生成提示语
    private planPrompt: string[] = [
        "你是一个计划助手。创建一个简洁、可执行的计划，包含清晰的步骤。",
        "关注关键里程碑而非详细子步骤。",
        "优先考虑清晰度和效率。"
    ];

    // 计划可行性验证提示语
    private validatePrompt: string[] = [
        "你是一个专业计划审计师，负责评估计划的逻辑性和完整性"
    ];

    // 生成计划方法
    private async generatePlan(userInput: string): Promise<PlanRuleType | undefined> {
        return lastValueFrom(requestWithRule({
            model: 'Pro/deepseek-ai/DeepSeek-R1',
            messages: [{ role: 'system', content: this.planPrompt.join('\n') }, { role: 'user', content: `用户需求: ${userInput}` }],
            temperature: 0.3
        }, PlanRule).pipe(retry(3)))
    }

    // 验证计划可行性
    private async validatePlan(plan: string): Promise<{ valid: boolean; feedback: string } | undefined> {
        const obj = z.object({
            valid: z.boolean({ description: '明确结论, true通过，false不通过，需要改进' }),
            feedback: z.string({ description: '给出结论的依据及原因' })
        })
        return lastValueFrom(requestWithRule({
            model: 'Pro/deepseek-ai/DeepSeek-R1',
            messages: [{ role: 'system', content: this.validatePrompt.join('\n') }, { role: 'user', content: `待验证计划: ${plan}` }],
            temperature: 0.3
        }, obj).pipe(retry(3)))
    }


    private async updatePlan(reason: string, plan: string): Promise<PlanRuleType | undefined> {
        return lastValueFrom(requestWithRule({
            model: 'Pro/deepseek-ai/DeepSeek-V3',
            messages: [{ role: 'system', content: this.planPrompt.join('\n') }, { role: 'user', content: `[原计划]: ${plan}` }, { role: 'user', content: `请根据修改意见：${reason}，根据你觉得合理的建议，修改[原计划], 不合理的建议可忽略` }],
            temperature: 0.3
        }, PlanRule).pipe(retry(3)))
    }

    async plan(projectId: number, max: number = 3): Promise<any> {
        const userInput = await useEntityManager([AiProject], async m => {
            const project = await m.findOneOrFail(AiProject, { where: { id: projectId } })
            return JSON.stringify(project)
        })
        let plan = await this.generatePlan(userInput);
        let validation = await this.validatePlan(JSON.stringify(plan));
        if (validation) {
            let runMax = max || 3;
            while (!validation.valid && runMax > 0) {
                plan = await this.updatePlan(validation.feedback, JSON.stringify(plan))
                if (!plan) break;
                const val = await this.validatePlan(JSON.stringify(plan));
                if (!val) break;
                validation = val;
                runMax -= 1;
            }
            // 保存到数据库 
            if (plan) await new PlanningFlow({}).addTasks(plan, projectId)
        } else {
            throw new Error(`校验阶段生成的格式不对`)
        }
    }
}

```
改为redis实现