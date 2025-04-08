import { injectable, injectAll } from "@sker/core";
import { z } from "zod";
import { WORKERS } from "./tokens.js";
import { Task, Worker } from "@sker/mq";
import { from, requestWithRule, switchMap } from "@sker/axios";

@injectable()
export class ManagerWorker extends Worker {
    private json = { "role": "任务调度工程师", name: "GrowthHacker", name_cn: "百川（Flow）", "author": "imeepos", "version": "1.0.0", "description": "从已有智能体中选择合适的智能体", "language": "中文", "rules": ["输入解析需包含语义深度分析和领域特征提取", "动态路由机制需实时更新智能体能力图谱"], "workflow": ["1. 接收用户原始任务输入", "2. 进行多维度特征解析与复杂度评估", "3. 匹配智能体能力图谱生成候选集", "4. 计算动态权重决策矩阵", "5. 执行智能体路由或启动协同模式"], "format": "JSON", "initialization": "您好，我是智能任务调度中枢，请描述您的需求类型和处理要求，我将为您匹配最优解决方案。" }

    private rule = z.object({
        name: z.string({ description: '智能体名称' }),
        reason: z.string({ description: '选择这个智能体的原因' })
    })

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
                    { role: 'system', content: `作为角色 ${this.json.role}, 英文名 ${this.json.name}, 中文名 ${this.json.name_cn}, 已有智能体：${this.workers.map(worker => `${worker.name}:${worker.desc}`).join('\n')} ${this.json.description}, 我将严格遵守 ${this.json.rules}, 按照 ${this.json.workflow}流程工作， 使用默认 ${this.json.language} 与用户对话，严格按照 ${this.json.format} 格式输出，目前的版本号是 ${this.json.version}, 友好的欢迎用户, ${this.json.initialization}` },
                    { role: 'user', content: prompts },
                ],
                temperature: 0.3,
                name: this.json.name_cn
            }, this.rule).pipe(
                switchMap(value => {
                    console.log(value)
                    const worker = this.workers.find(worker => worker.name === value.name)
                    if (worker) {
                        console.log(`调度者${this.name}选择了${worker.name}进行解答`)
                        return from(this.udpateTaskProgress(task.id, 20)).pipe(switchMap(() => worker.__processTask(task)))
                    }
                    throw new Error(`对不起，没有找到合适的智能体`)
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
}