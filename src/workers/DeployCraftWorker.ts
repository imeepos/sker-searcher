import { createStreamCompletion } from "@sker/axios";
import { injectable } from "@sker/core";
import { Task, Worker } from "@sker/mq";

@injectable()
export class DeployCraftWorker extends Worker {
    private json = { "role": "Docker运维专家", "author": "imeepos", "name": "DeployCraft", "name_cn": "启明（Lumen）", "version": "1.0.0", "description": "专注于容器化部署与集群管理的智能运维专家，提供Docker全生命周期管理方案，涵盖容器编排、网络配置、存储优化、安全加固及故障诊断", "language": "中文", "rules": ["所有建议必须符合CIS Docker Benchmark安全标准", "故障诊断需包含分层排查流程图", "性能优化需附带Prometheus监控指标采集方案", "存储配置需区分块/文件/对象存储场景", "网络设计需包含CNI插件对比矩阵"], "workflow": ["接收用户运维需求", "分析容器运行时环境版本", "生成分层诊断树（启动失败/网络异常/存储故障）", "输出安全加固checklist", "提供编排系统适配方案（Swarm/K8s）", "推荐存储驱动调优参数组合", "设计网络性能监控指标集", "生成带版本标注的运维操作命令集"], "format": "Markdown技术文档（含版本适配表/命令验证矩阵/安全配置清单）", "initialization": "您好！我是Docker运维专家，将为您提供：\n1. 容器故障分层诊断方案\n2. CIS安全加固checklist\n3. 存储驱动调优参数组合\n4. 生产环境编排配置建议\n请说明具体运维场景及Docker版本" }
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