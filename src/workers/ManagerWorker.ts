import { injectable, injectAll } from "@sker/core";
import { z } from "zod";
import { WORKERS } from "./tokens.js";
import { Task, Worker } from "@sker/mq";
import { concatMap, map, from, Observable, of, requestWithRule, switchMap, tap, toArray } from "@sker/axios";
import { randomUUID } from "crypto";

export interface Node {
    id: string;
    name: string;
    reason: string;
    prompts: string;
    nodes: Node[];
    result?: any;
}
const nodes: any = z.array(z.object({
    name: z.string({ description: '智能体名称' }),
    reason: z.string({ description: '选择这个智能体的原因' }),
    prompts: z.string({ description: '任务要求描述' }),
    nodes: z.lazy(() => nodes, { description: '子级任务，同级任务并行，子级任务串行' })
}))
@injectable()
export class ManagerWorker extends Worker {
    private json = {
        "role": "任务调度工程师",
        name: "GrowthHacker",
        name_cn: "百川（Flow）",
        "author": "imeepos",
        "version": "1.0.0",
        "description": "从已有智能体中选择合适的智能体",
        "language": "中文",
        "rules": [
            "输入解析需包含语义深度分析和领域特征提取",
            "动态路由机制需实时更新智能体能力图谱",
            "支持串行和并行任务编排",
            "如：拿到一个需求后，首先产品进行需求细化，然后指定前后端对接接口规范，然后前端和后端根据规范和细化后的需求文档并行开发，然后测试则需要前端完成后测试前端，后端完成后测试后端，前后端联调需要放在前端和后端完成后进行，联调结束后，测试进行整体测试"
        ],
        "workflow": [
            "1. 接收用户原始任务输入",
            "2. 进行多维度特征解析与复杂度评估",
            "3. 将任务划分为多个步骤，支持串行和并行模式",
            "4. 设计智能体之间的协作顺序和并行关系"
        ],
        "format": "JSON",
        "initialization": "您好，我是智能任务调度中枢，支持串行和并行任务处理，请描述您的需求类型和处理要求，我将为您匹配最优解决方案。"
    }

    private rule = nodes;
    private nodes: Node[] = [];

    constructor(@injectAll(WORKERS) private workers: Worker[]) {
        super();
    }
    async __processTask<T = any>(task: Task): Promise<T> {
        const body = task.request
        const prompts = body.prompts
        return new Promise<any>((resolve, reject) => {
            requestWithRule({
                model: 'Pro/deepseek-ai/DeepSeek-V3',
                messages: [
                    {
                        role: 'system', content: `# 角色说明
    你是一位专业的${this.json.role}(${this.json.name_cn})，负责智能任务调度和编排。
    
    # 能力说明
    1. 多维度特征解析与复杂度评估
    2. 智能体动态路由与能力匹配
    3. 支持串行和并行任务编排
    4. 实时监控任务执行状态
    
    # 可用智能体
    ${this.workers.map(worker => `- ${worker.name}: ${worker.desc}`).join('\n')}
    
    # 工作流程
    1. 接收用户原始任务输入
    2. 进行任务分解和复杂度评估
    3. 设计执行计划(明确串行/并行关系)
    4. 分配任务给最适合的智能体
    5. 监控执行并处理异常
    6. 尽量用最少的智能体完成任务
    7. 识别用户需求类型，如果非开发需求那么就不用测试/前端/后端/运维等人员
    
    # 输出要求
    - 严格按照JSON格式输出
    - 明确标注每个任务的执行顺序
    - 为每个子任务选择最合适的智能体并说明理由
    - 串行任务放在同级节点
    - 并行任务放在下级节点
    
    # 开发需求-示例
    输入: "开发一个电商网站"
    输出: {
        "name": "电商网站开发",
        "reason": "复杂项目需要多阶段协作",
        "prompts": "开发一个完整的电商网站",
        "nodes": [
            {
                "name": "产品设计",
                "reason": "需要先明确产品需求和原型",
                "prompts": "设计电商网站的产品原型和需求文档",
                "nodes": [
                       {
                            "name": "技术实现",
                            "reason": "技术实现可以并行开发",
                            "prompts": "实现电商网站的技术架构",
                            "nodes": [
                                {
                                    "name": "前端开发",
                                    "reason": "需要实现用户界面",
                                    "prompts": "开发电商网站前端界面"
                                },
                                {
                                    "name": "后端开发",
                                    "reason": "需要实现业务逻辑和API",
                                    "prompts": "开发电商网站后端服务"
                                }
                            ]
                        } 
                ]
            },
            
        ]
    }` },
                    {
                        role: 'user', content: `请为以下任务创建详细的执行计划:
任务描述: ${prompts}

要求:
1. 分析任务复杂度并分解为子任务
2. 为每个子任务选择最合适的智能体并说明理由
3. 明确标注串行和并行关系
4. 为每个子任务生成清晰的任务描述(prompts)` },
                ],
                temperature: 0.3,
                name: this.json.name_cn
            }, this.rule).pipe(
                switchMap((plan: any) => {
                    if (!plan) throw new Error(`生成开发计划失败`)
                    this.nodes = plan.map((n: Node) => {
                        n.id = randomUUID()
                        return n;
                    });
                    return this.executeNodes(this.nodes, task, null).pipe(
                        switchMap(() => of(this.nodes))
                    )
                })
            ).subscribe({
                next(value) {
                    resolve(value)
                },
                error(err) {
                    reject(err)
                },
                complete: () => {

                },
            })
        })
    }

    private executeNodes(nodes: Node[], task: Task, pnode: Node | null) {
        if (!nodes || nodes.length === 0) {
            return of([]);
        }

        // 保持原有节点引用
        return from(nodes).pipe(
            concatMap((node: Node) => {
                // 为每个节点创建唯一ID（如果尚未创建）
                node.id = node.id || randomUUID();
                return this.executeSingleNode(node, task, pnode);
            }),
            toArray(),
            map(processedNodes => {
                // 直接返回处理后的节点数组（保持引用）
                return processedNodes;
            })
        );
    }

    private executeSingleNode(node: Node, task: Task, pnode: Node | null): Observable<Node> {
        return this.executeAgentTask(node, task, pnode).pipe(
            switchMap(val => {
                // 直接修改节点对象（保持引用）
                node.result = val;

                if (node.nodes && node.nodes.length > 0) {
                    // 递归处理子节点时传递修改后的prompts
                    const childTasks = node.nodes.map(child => ({
                        ...child,
                        prompts: `【原始需求】${task.request.prompts}\n【参考资料】${val} \n 【当前任务】${child.prompts}`
                    }));

                    return this.executeNodes(childTasks, task, node).pipe(
                        map(childResults => {
                            // 直接替换子节点数组（保持引用）
                            node.nodes = childResults;
                            return node;
                        })
                    );
                }
                return of(node);
            })
        );
    }


    private executeAgentTask(agent: Node, task: Task, pnode: Node | null) {
        let worker = this.workers.find(w => w.name === agent.name);
        if (!worker && pnode) {
            worker = this.workers.find(w => w.name === pnode.name);
        }
        if (!worker) {
            return of(null);
        }

        const agentTask = {
            ...task,
            request: {
                ...task.request,
                prompts: agent.prompts
            }
        };

        return from(worker.__processTask(agentTask));
    }
}