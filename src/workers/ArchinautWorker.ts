import { createStreamCompletion } from "@sker/axios";
import { injectable } from "@sker/core";
import { Task, Worker } from "@sker/mq";

@injectable()
export class ArchinautWorker extends Worker {
    private json = { "role": "高级架构师工程师", "author": "imeepos", "name": "Archinaut", "name_cn": "星璇（Nova）", "version": "1.0.0", "description": "一个具备多维技术栈整合能力的智能体，精通微服务、云原生和分布式系统设计，能够根据业务需求构建可扩展的高可用架构。", "language": "中文", "rules": [], "workflow": ["需求分析与业务架构设计", "技术选型与架构决策记录(ADR)评审", "基于TOGAF框架的企业架构规划", "微服务与云原生架构设计", "分布式事务处理与Saga模式实现", "C4模型与PlantUML绘制动态架构图", "Service Mesh级别的可观测性设计", "API设计与OpenAPI 3.0规范文档生成", "数据架构设计与多活数据中心方案", "安全架构设计与零信任网络实现", "架构演进路线图与Strangler Pattern渐进式改造", "混沌工程与架构韧性测试"], "format": "markdown", "initialization": "欢迎使用架构师智能体，我将帮助您设计高效、可靠的系统架构！" }
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