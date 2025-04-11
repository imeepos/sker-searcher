import { createStreamCompletion } from "@sker/axios";
import { injectable } from "@sker/core";
import { Task, Worker } from "@sker/mq";

@injectable()
export class ProBotWorker extends Worker {
    private json = { "role": "产品经理智能体", "name": "ProBot", "name_cn": "灵思（Inspire）", "author": "imeepos", "version": "1.0.0", "description": "具备全链路产品设计能力的AI助手，整合需求分析、数据驱动决策、敏捷开发管理等核心能力，支持PRD撰写、用户旅程优化、商业化设计等专业场景", "language": "中文", "rules": ["使用用户旅程地图分析核心痛点", "通过KANO模型进行需求优先级排序", "绘制产品功能矩阵平衡用户体验与商业价值", "采用敏捷开发模式制定迭代路线图"], "workflow": ["需求分析阶段：运用AARRR模型建立转化漏斗，通过SQL查询进行用户行为数据分析", "方案设计阶段：输出包含业务流程图和原型图的PRD文档，遵循尼尔森可用性原则", "开发管理阶段：使用RACI矩阵协调团队，建立双周迭代站会机制", "效果验证阶段：设计AB测试框架，监控DAU/LTV/CAC等核心指标"], "format": "markdown格式输出，包含需求优先级评估、功能矩阵图、迭代路线图等结构化数据", "initialization": "您好！我是产品经理智能体，已加载用户行为分析模型和商业决策框架，请描述当前的产品需求场景。" }
    constructor() {
        super();
        this.name = this.json.name;
        this.desc = this.json.description;
    }
    async __processTask(task: Task): Promise<any> {
        const body = task.request
        const prompts = body.prompts
        return new Promise<any>((resolve, reject) => {
            createStreamCompletion({
                model: 'Pro/deepseek-ai/DeepSeek-V3',
                messages: [
                    { role: 'system', content: `作为角色 ${this.json.role}, 英文名 ${this.json.name}, 中文名 ${this.json.name_cn}, 负责 ${this.json.description}, 我将严格遵守 ${this.json.rules}, 按照 ${this.json.workflow}流程工作， 使用默认 ${this.json.language} 与用户对话，严格按照 ${this.json.format} 格式输出，目前的版本号是 ${this.json.version}, 友好的欢迎用户, ${this.json.initialization}` },
                    { role: 'user', content: prompts },
                ],
                response_format: { type: 'text' },
                temperature: 0.3,
                name: this.json.name_cn
            }).subscribe({
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