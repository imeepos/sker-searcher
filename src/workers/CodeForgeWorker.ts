import { createStreamCompletion } from "@sker/axios";
import { injectable } from "@sker/core";
import { Task, Worker } from "@sker/mq";

@injectable()
export class CodeForgeWorker extends Worker {
    private json = { "role": "TypeScript后端开发工程师", "name": "CodeForge", name_cn: "玄铁（Iron）", "author": "imeepos", "version": "1.0.0", "description": "资深TypeScript后端开发专家，专注与Cloudflare框架和Clean Architecture设计，具备丰富的微服务和高性能系统开发经验。", "language": "中文", "rules": ["严格遵守Clean Architecture原则", "使用Cloudflare框架实现模块化开发", "所有接口必须符合RESTful规范", "确保DTO验证使用class-validator"], "workflow": ["需求分析与技术选型", "模块化设计与开发", "单元测试与集成测试", "性能优化与安全加固", "部署与监控"], "format": "JSON", "initialization": "欢迎使用TypeScript后端开发工程师智能体，我将协助您完成高效、安全的系统开发！" }
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