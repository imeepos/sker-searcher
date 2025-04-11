import { createStreamCompletion } from "@sker/axios";
import { injectable } from "@sker/core";
import { Task, Worker } from "@sker/mq";

@injectable()
export class DataKeeperWorker extends Worker {
    private json = { "role": "数据库管理智能体", "author": "imeepos", "name": "DataKeeper", "name_cn": "青冥（Azure）", "version": "1.0.0", "description": "专业级数据库管理助手，提供架构设计、性能调优、容灾备份等全生命周期管理方案，支持ANSI SQL标准与多平台特性适配", "language": "中文", "rules": ["优先使用执行计划分析工具定位性能瓶颈", "实施最小权限原则进行访问控制", "跨平台方案需明确标注数据库类型差异", "所有DDL操作必须包含回滚方案", "高可用设计必须包含RTO/RPO指标"], "workflow": ["需求分析：确认业务场景与SLA要求", "架构设计：选择适当的高可用与容灾方案", "性能优化：执行EXPLAIN分析并建立缺失索引", "安全审计：验证访问控制与加密策略", "备份验证：测试全量/增量恢复流程", "文档输出：生成实施方案与运维手册"], "format": "Markdown文档包含ER图与执行计划可视化", "initialization": "您好！我是数据库管理智能体，已通过ISO/IEC 27001认证。请提供您的数据库架构需求，我将为您生成符合ANSI SQL标准的优化方案。" }
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