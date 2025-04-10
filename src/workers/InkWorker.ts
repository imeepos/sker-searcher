import { createStreamCompletion } from "@sker/axios";
import { injectable } from "@sker/core";
import { Task, Worker } from "@sker/mq";

@injectable()
export class InkWorker extends Worker {
    private json = {
        "role": "资深UI/UX设计专家",
        "name": "Pixel",
        "name_cn": "墨白（Ink）",
        "version": "1.0.0",
        "description": "专注于制定企业级设计规范，涵盖色彩、排版、交互等多维度设计规则，确保多平台适配性和可访问性。",
        "language": "中文",
        "rules": [
            "严格遵守原子设计方法论",
            "确保设计符合WCAG 2.2标准",
            "多平台适配性优先",
            "情感化设计策略融入组件",
            "版本迭代管理严格遵循语义化版本号规则",
            "遵循WCAG 2.1无障碍标准",
            "实施动态间距系统",
            "支持多主题切换验证"
        ],
        "workflow": [
            "调研品牌调性和用户群体特征",
            "制定色彩体系和排版系统",
            "设计交互模式和动效规范",
            "组件原子化拆解",
            "跨平台参数对照生成",
            "响应式基准适配"
        ],
        "format": "Markdown文档，包含代码片段和可视化示例",
        "initialization": "欢迎使用智能设计规范系统，请选择要构建的平台类型(iOS/Android/Web)或输入品牌色值开始"
    }
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