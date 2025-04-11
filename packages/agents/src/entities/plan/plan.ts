import { useRedisClient } from '@sker/redis';
import { z } from "zod";
import { requestWithRule, lastValueFrom, retry, from } from '@sker/axios'
import { PlanStatus, PlanPriority } from './types.js'
import { Plan } from './AiPlan.js'
import { useEntityManager } from '@sker/orm';
import { AiProject } from '../project/project.js';

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

// Redis key patterns
const TASK_KEY = (id: string) => `task:${id}`;
const TASK_DEPENDENCIES_KEY = (id: string) => `task:${id}:dependencies`;
const PROJECT_TASKS_KEY = (projectId: number) => `project:${projectId}:tasks`;
const ALL_TASKS_KEY = 'tasks:all';
const TASK_LOGS_KEY = (id: string) => `task:${id}:logs`;

interface PlanningFlowOptions {
    maxConcurrentTasks?: number;
    onTaskStart?: (task: Task) => void;
    onTaskComplete?: (task: Task) => void;
    onTaskFail?: (task: Task, error: Error) => void;
}

export class RedisPlanningFlow {
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

    private async logTaskEvent(taskId: string, event: string, data?: any): Promise<void> {
        return useRedisClient(async client => {
            await client.rPush(TASK_LOGS_KEY(taskId), JSON.stringify({
                timestamp: new Date().toISOString(),
                event,
                data
            }));
        });
    }

    // 添加性能监控方法
    async getPerformanceMetrics(): Promise<{
        totalTasks: number;
        completedTasks: number;
        failedTasks: number;
        avgTaskDuration: number;
    }> {
        return useRedisClient(async client => {
            const taskIds = await client.sMembers(ALL_TASKS_KEY);
            let completed = 0;
            let failed = 0;
            let totalDuration = 0;
            let durationCount = 0;

            for (const taskId of taskIds) {
                const taskData = await client.hGetAll(TASK_KEY(taskId));

                if (taskData.status === 'completed') completed++;
                if (taskData.status === 'failed') failed++;

                if (taskData.startTime && taskData.endTime) {
                    const start = new Date(taskData.startTime);
                    const end = new Date(taskData.endTime);
                    totalDuration += end.getTime() - start.getTime();
                    durationCount++;
                }
            }

            return {
                totalTasks: taskIds.length,
                completedTasks: completed,
                failedTasks: failed,
                avgTaskDuration: durationCount > 0 ? totalDuration / durationCount : 0
            };
        });
    }

    /**
     * Add a task to Redis
     */
    async addTask(task: Omit<Task, 'status' | 'dependencies'> & { dependencies?: string[], projectId?: number }): Promise<void> {
        return await useRedisClient(async client => {
            const multi = client.multi();

            // Add task data
            multi.hSet(TASK_KEY(task.id), {
                id: task.id,
                name: task.name,
                description: task.description || '',
                priority: task.priority,
                status: 'pending',
                projectId: String(task.projectId || 0),
                startTime: '',
                endTime: ''
            });

            // Add to all tasks set
            multi.sAdd(ALL_TASKS_KEY, task.id);

            // Add to project tasks if projectId is specified
            if (task.projectId) {
                multi.sAdd(PROJECT_TASKS_KEY(task.projectId), task.id);
            }

            // Add dependencies if any
            if (task.dependencies && task.dependencies.length > 0) {
                task.dependencies.forEach(depId => {
                    multi.sAdd(TASK_DEPENDENCIES_KEY(task.id), depId);
                });
            }

            await multi.exec();
        });
    }

    /**
     * Add multiple tasks at once
     */
    async addTasks(tasks: Omit<Task, 'status'>[], projectId: number): Promise<void> {
        return useRedisClient(async client => {
            const multi = client.multi();

            for (const task of tasks) {
                // Add task data
                multi.hSet(TASK_KEY(task.id), {
                    id: task.id,
                    name: task.name,
                    description: task.description || '',
                    priority: task.priority,
                    status: 'pending',
                    projectId: String(projectId),
                    startTime: '',
                    endTime: ''
                });

                // Add to all tasks set
                multi.sAdd(ALL_TASKS_KEY, task.id);

                // Add to project tasks
                multi.sAdd(PROJECT_TASKS_KEY(projectId), task.id);

                // Add dependencies
                if (task.dependencies && task.dependencies.length > 0) {
                    task.dependencies.forEach(depId => {
                        multi.sAdd(TASK_DEPENDENCIES_KEY(task.id), depId);
                    });
                }
            }

            await multi.exec();
        });
    }

    /**
     * Get all tasks
     */
    async getTasks(): Promise<Task[]> {
        return useRedisClient(async client => {
            const taskIds = await client.sMembers(ALL_TASKS_KEY);
            const tasks: Task[] = [];

            for (const id of taskIds) {
                const taskData = await client.hGetAll(TASK_KEY(id));
                if (!taskData.id) continue; // Skip if task doesn't exist

                const dependencies = await client.sMembers(TASK_DEPENDENCIES_KEY(id));

                tasks.push({
                    id: taskData.id,
                    name: taskData.name,
                    description: taskData.description || undefined,
                    status: taskData.status as PlanStatus,
                    priority: taskData.priority as PlanPriority,
                    dependencies,
                    startTime: taskData.startTime ? new Date(taskData.startTime) : undefined,
                    endTime: taskData.endTime ? new Date(taskData.endTime) : undefined,
                    projectId: taskData.projectId ? parseInt(taskData.projectId) : undefined
                });
            }

            return tasks;
        });
    }

    /**
     * Get a specific task
     */
    async getTask(id: string): Promise<Task | undefined> {
        return useRedisClient(async client => {
            const taskData = await client.hGetAll(TASK_KEY(id));
            if (!taskData.id) return undefined;

            const dependencies = await client.sMembers(TASK_DEPENDENCIES_KEY(id));

            return {
                id: taskData.id,
                name: taskData.name,
                description: taskData.description || undefined,
                status: taskData.status as PlanStatus,
                priority: taskData.priority as PlanPriority,
                dependencies,
                startTime: taskData.startTime ? new Date(taskData.startTime) : undefined,
                endTime: taskData.endTime ? new Date(taskData.endTime) : undefined,
                projectId: taskData.projectId ? parseInt(taskData.projectId) : undefined
            };
        });
    }

    private async updateParentPlanStatus(taskId: string): Promise<void> {
        return useRedisClient(async client => {
            // 查找所有依赖此任务的任务
            const allTasks = await client.sMembers(ALL_TASKS_KEY);

            for (const potentialParentId of allTasks) {
                const dependencies = await client.sMembers(TASK_DEPENDENCIES_KEY(potentialParentId));

                if (dependencies.includes(taskId)) {
                    // 检查所有依赖是否都已完成
                    const allDepsCompleted = await this.checkAllDependenciesCompleted(potentialParentId);

                    if (allDepsCompleted) {
                        // 如果所有依赖都已完成，将父任务状态更新为 pending
                        await client.hSet(TASK_KEY(potentialParentId), 'status', 'pending');
                    }
                }
            }
        });
    }

    private async checkAllDependenciesCompleted(taskId: string): Promise<boolean> {
        return useRedisClient(async client => {
            const dependencies = await client.sMembers(TASK_DEPENDENCIES_KEY(taskId));

            for (const depId of dependencies) {
                const depData = await client.hGetAll(TASK_KEY(depId));
                if (depData.status !== 'completed') {
                    return false;
                }
            }

            return true;
        });
    }

    async deleteTask(taskId: string): Promise<void> {
        return useRedisClient(async client => {
            const multi = client.multi();

            // 获取任务数据以获取项目ID
            const taskData = await client.hGetAll(TASK_KEY(taskId));
            const projectId = taskData.projectId ? parseInt(taskData.projectId) : undefined;

            // 删除任务数据
            multi.del(TASK_KEY(taskId));

            // 从所有任务集合中移除
            multi.sRem(ALL_TASKS_KEY, taskId);

            // 从项目任务集合中移除
            if (projectId) {
                multi.sRem(PROJECT_TASKS_KEY(projectId), taskId);
            }

            // 删除依赖关系
            multi.del(TASK_DEPENDENCIES_KEY(taskId));

            // 删除任务日志
            multi.del(TASK_LOGS_KEY(taskId));

            await multi.exec();
        });
    }

    async updateTask(taskId: string, updates: Partial<Omit<Task, 'id'>>): Promise<void> {
        return useRedisClient(async client => {
            const currentTask = await this.getTask(taskId);
            if (!currentTask) throw new Error(`Task ${taskId} not found`);

            const multi = client.multi();

            // 更新任务数据
            const updatedFields: Record<string, string> = {};
            if (updates.name) updatedFields.name = updates.name;
            if (updates.description) updatedFields.description = updates.description;
            if (updates.priority) updatedFields.priority = updates.priority;
            if (updates.status) updatedFields.status = updates.status;

            if (Object.keys(updatedFields).length > 0) {
                multi.hSet(TASK_KEY(taskId), updatedFields);
            }

            // 更新依赖关系
            if (updates.dependencies) {
                // 先删除现有依赖
                multi.del(TASK_DEPENDENCIES_KEY(taskId));

                // 添加新依赖
                for (const depId of updates.dependencies) {
                    multi.sAdd(TASK_DEPENDENCIES_KEY(taskId), depId);
                }
            }

            await multi.exec();
        });
    }

    async refineTask(task: Plan) {
        return PlanningReActAgent.plan(JSON.stringify(task))
    }


    async checkTaskisMeta(task: Plan) {
        return lastValueFrom(requestWithRule({
            model: 'Pro/deepseek-ai/DeepSeek-V3',
            messages: [{
                role: 'system',
                content: `
                You are a task analysis expert. Your job is to determine if a given task is a "meta-task" (原子任务) that cannot be further broken down.
    
                【Meta-Task Criteria】:
                1. The task is an atomic operation that can be completed in a single step
                2. The task cannot be logically divided into smaller subtasks
                3. The task represents a concrete action rather than a conceptual goal
                4. The task requires no additional planning or decomposition
                5. The task can be directly executed by a system or human
    
                Examples of meta-tasks:
                - "Call API endpoint /user/create with provided data"
                - "Send email to customer@example.com with template A"
                - "Update database record ID 123 with new status"
    
                Examples of non-meta tasks:
                - "Implement user registration system"
                - "Improve website performance"
                - "Create marketing campaign"
    
                Respond strictly with JSON format containing:
                - isMeta: boolean (true if meta-task)
                - reason: string (explain your determination)
                `
            }, {
                role: 'user',
                content: `Analyze this task: ${JSON.stringify(task)}`
            }],
            temperature: 0.3,
        }, z.object({
            isMeta: z.boolean({ description: '是否【元任务】【元任务】表示不可再细化，可直接单步实现' }),
            reason: z.string({ description: '原因' })
        })))
    }

    async executeMetaTask(task: Plan) {
        console.log(`执行元任务: ${task.id} - ${task.name}`);
        // 根据任务类型执行不同的操作
        try {
            // 这里可以根据任务类型实现具体的执行逻辑
            // 例如: API调用、数据库操作、文件处理等

            // 模拟执行延迟
            await new Promise(resolve => setTimeout(resolve, 1000));

            console.log(`元任务 ${task.id} 执行完成`);
        } catch (error) {
            console.error(`元任务 ${task.id} 执行失败:`, error);
            throw error;
        }
    }

    /**
     * Execute a task
     */
    async executeTask(taskId: string): Promise<void> {
        return useRedisClient(async client => {
            try {
                // Get task data
                const taskData = await client.hGetAll(TASK_KEY(taskId));
                if (!taskData.id) return;

                // Update task status to in-progress
                await client.hSet(TASK_KEY(taskId), {
                    status: 'in-progress',
                    startTime: new Date().toISOString()
                });

                // Get dependencies
                const dependencies = await client.sMembers(TASK_DEPENDENCIES_KEY(taskId));

                // Log task start
                await client.rPush(TASK_LOGS_KEY(taskId), JSON.stringify({
                    timestamp: new Date().toISOString(),
                    status: 'in-progress',
                    message: 'Task started'
                }));

                this.onTaskStart({
                    id: taskData.id,
                    name: taskData.name,
                    description: taskData.description || undefined,
                    status: 'in-progress',
                    priority: taskData.priority as PlanPriority,
                    dependencies,
                    startTime: new Date(),
                    projectId: taskData.projectId ? parseInt(taskData.projectId) : undefined
                });

                // Simulate task execution
                if (taskData.isMeta === 'true') {
                    await this.executeMetaTask(taskData as unknown as Plan);
                } else {
                    // 检查
                    const isMeta = await this.checkTaskisMeta(taskData as unknown as Plan)
                    if (isMeta.isMeta) {
                        await this.executeMetaTask(taskData as unknown as Plan);
                    } else {
                        const refinedTasks = await this.refineTask(taskData as unknown as Plan);
                        if (refinedTasks) {
                            await this.addTasks(refinedTasks, parseInt(taskData.projectId || '0'));
                        }
                    }
                }
                // Mark task as completed
                await client.hSet(TASK_KEY(taskId), {
                    status: 'completed',
                    endTime: new Date().toISOString()
                });

                // Log task completion
                await client.rPush(TASK_LOGS_KEY(taskId), JSON.stringify({
                    timestamp: new Date().toISOString(),
                    status: 'completed',
                    message: 'Task completed successfully'
                }));

                this.onTaskComplete({
                    id: taskData.id,
                    name: taskData.name,
                    description: taskData.description || undefined,
                    status: 'completed',
                    priority: taskData.priority as PlanPriority,
                    dependencies,
                    startTime: new Date(taskData.startTime || ''),
                    endTime: new Date(),
                    projectId: taskData.projectId ? parseInt(taskData.projectId) : undefined
                });

                await this.updateParentPlanStatus(taskId);
            } catch (error) {
                // Update task status to failed
                await client.hSet(TASK_KEY(taskId), {
                    status: 'failed',
                    endTime: new Date().toISOString()
                });

                // Log failure
                await client.rPush(TASK_LOGS_KEY(taskId), JSON.stringify({
                    timestamp: new Date().toISOString(),
                    status: 'failed',
                    message: (error as Error).message
                }));

                const task = await this.getTask(taskId);
                if (task) {
                    this.onTaskFail(task, error as Error);
                }
                throw error;
            }
        });
    }

    /**
     * Get task dependencies
     */
    async getTaskDependencies(taskId: string): Promise<string[]> {
        return useRedisClient(async client => {
            return await client.sMembers(TASK_DEPENDENCIES_KEY(taskId));
        });
    }


    private async executeTaskWithRetry(taskId: string, maxRetries: number = 3, delay: number = 1000): Promise<void> {
        let attempts = 0;

        while (attempts <= maxRetries) {
            try {
                return await this.executeTask(taskId);
            } catch (error) {
                attempts++;
                if (attempts > maxRetries) {
                    throw error;
                }

                console.warn(`Retrying task ${taskId} (attempt ${attempts}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay * attempts));
            }
        }

        throw new Error(`Max retries (${maxRetries}) exceeded for task ${taskId}`);
    }
    /**
     * Start task execution flow
     */
    async start(projectId?: number): Promise<void> {
        while (await this.hasPendingTasks(projectId)) {
            // Get all executable tasks (pending status with completed dependencies)
            const executableTasks = await useRedisClient(async client => {
                const allTaskIds = projectId !== undefined
                    ? await client.sMembers(PROJECT_TASKS_KEY(projectId))
                    : await client.sMembers(ALL_TASKS_KEY);

                const executable: Task[] = [];

                for (const taskId of allTaskIds) {
                    const taskData = await client.hGetAll(TASK_KEY(taskId));
                    if (taskData.status !== 'pending') continue;

                    const dependencies = await client.sMembers(TASK_DEPENDENCIES_KEY(taskId));
                    let allDepsCompleted = true;

                    for (const depId of dependencies) {
                        const depData = await client.hGetAll(TASK_KEY(depId));
                        if (depData.status !== 'completed') {
                            allDepsCompleted = false;
                            break;
                        }
                    }

                    if (allDepsCompleted) {
                        executable.push({
                            id: taskData.id,
                            name: taskData.name,
                            description: taskData.description || undefined,
                            status: taskData.status as PlanStatus,
                            priority: taskData.priority as PlanPriority,
                            dependencies,
                            startTime: taskData.startTime ? new Date(taskData.startTime) : undefined,
                            endTime: taskData.endTime ? new Date(taskData.endTime) : undefined,
                            projectId: taskData.projectId ? parseInt(taskData.projectId) : undefined
                        });
                    }
                }

                // Sort by priority
                return executable.sort((a, b) => {
                    const priorityOrder: Record<PlanPriority, number> = {
                        'critical': 0,
                        'high': 1,
                        'medium': 2,
                        'low': 3
                    };
                    return priorityOrder[a.priority] - priorityOrder[b.priority];
                });
            });

            // Get current active tasks count
            const activeTasksCount = await useRedisClient(async client => {
                const allTaskIds = projectId !== undefined
                    ? await client.sMembers(PROJECT_TASKS_KEY(projectId))
                    : await client.sMembers(ALL_TASKS_KEY);

                let count = 0;

                for (const taskId of allTaskIds) {
                    const taskData = await client.hGetAll(TASK_KEY(taskId));
                    if (taskData.status === 'in-progress') {
                        count++;
                    }
                }

                return count;
            });

            const availableSlots = this.maxConcurrentTasks - activeTasksCount;
            const tasksToExecute = executableTasks.slice(0, availableSlots);

            await Promise.all(tasksToExecute.map(task => this.executeTaskWithRetry(task.id)));

            if (tasksToExecute.length === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    }

    /**
     * Check if there are pending tasks
     */
    async hasPendingTasks(projectId?: number): Promise<boolean> {
        return useRedisClient(async client => {
            const taskIds = projectId !== undefined
                ? await client.sMembers(PROJECT_TASKS_KEY(projectId))
                : await client.sMembers(ALL_TASKS_KEY);

            for (const taskId of taskIds) {
                const taskData = await client.hGetAll(TASK_KEY(taskId));
                if (taskData.status === 'pending' || taskData.status === 'in-progress') {
                    return true;
                }
            }

            return false;
        });
    }
}

export class PlanningReActAgent {
    private planPrompt: string[] = [
        "你是一个计划助手。创建一个简洁、可执行的计划，包含清晰的步骤。",
        "关注关键里程碑而非详细子步骤。",
        "优先考虑清晰度和效率。"
    ];

    private validatePrompt: string[] = [
        "你是一个专业计划审计师，负责评估计划的逻辑性和完整性"
    ];

    private async generatePlan(userInput: string): Promise<PlanRuleType | undefined> {
        return lastValueFrom(requestWithRule({
            model: 'Pro/deepseek-ai/DeepSeek-R1',
            messages: [{ role: 'system', content: this.planPrompt.join('\n') }, { role: 'user', content: `用户需求: ${userInput}` }],
            temperature: 0.3
        }, PlanRule).pipe(retry(3)))
    }

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


    private async preprocessInput(input: string): Promise<string> {
        // 对输入进行预处理，提取关键信息
        return lastValueFrom(requestWithRule({
            model: 'Pro/deepseek-ai/DeepSeek-V3',
            messages: [{
                role: 'system',
                content: '你是一个信息提取专家。请从以下输入中提取关键需求和目标，去除无关信息。'
            }, {
                role: 'user',
                content: input
            }],
            temperature: 0.2
        }, z.string()));
    }

    private async postprocessPlan(plan: PlanRuleType): Promise<PlanRuleType> {
        // 对生成的计划进行后处理，优化任务描述和依赖关系
        return lastValueFrom(requestWithRule({
            model: 'Pro/deepseek-ai/DeepSeek-V3',
            messages: [{
                role: 'system',
                content: '你是一个计划优化专家。请优化以下任务计划，确保任务描述清晰、依赖关系合理。'
            }, {
                role: 'user',
                content: JSON.stringify(plan)
            }],
            temperature: 0.2
        }, PlanRule));
    }

    private async updatePlan(reason: string, plan: string): Promise<PlanRuleType | undefined> {
        return lastValueFrom(requestWithRule({
            model: 'Pro/deepseek-ai/DeepSeek-V3',
            messages: [{ role: 'system', content: this.planPrompt.join('\n') }, { role: 'user', content: `[原计划]: ${plan}` }, { role: 'user', content: `请根据修改意见：${reason}，根据你觉得合理的建议，修改[原计划], 不合理的建议可忽略` }],
            temperature: 0.3
        }, PlanRule).pipe(retry(3)))
    }

    static plan(projectIdOrUserInput: number | string, max: number = 3) {
        return new PlanningReActAgent().plan(projectIdOrUserInput, max)
    }
    async plan(projectId: number | string, max: number = 3) {
        let userInput = ``;
        if (typeof projectId === 'string') {
            userInput = projectId;
        } else {
            const project = await useEntityManager([AiProject], async m => {
                return m.findOneOrFail(AiProject, { where: { id: projectId } });
            });
            userInput = JSON.stringify(project);
        }

        // 预处理输入
        const processedInput = await this.preprocessInput(userInput);

        let plan = await this.generatePlan(processedInput);
        if (!plan) throw new Error('Failed to generate initial plan');

        // 后处理计划
        plan = await this.postprocessPlan(plan);

        let validation = await this.validatePlan(JSON.stringify(plan));
        if (!validation) throw new Error('Validation failed');

        let runMax = max || 3;
        while (!validation.valid && runMax > 0) {
            plan = await this.updatePlan(validation.feedback, JSON.stringify(plan));
            if (!plan) break;

            const val = await this.validatePlan(JSON.stringify(plan));
            if (!val) break;

            validation = val;
            runMax -= 1;
        }

        if (!validation.valid) {
            console.warn('Plan validation failed after maximum attempts');
        }

        return plan;
    }
}
