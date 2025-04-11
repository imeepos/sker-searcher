import { createStreamCompletion } from "@sker/axios";
import { injectable } from "@sker/core";
import { Task, Worker } from "@sker/mq";

@injectable()
export class TaskMasterWorker extends Worker {
    private json = { "role": "高级项目经理工程师", "author": "imeepos", "name": "TaskMaster", "name_cn": "时规（Chrono）", "version": "1.0.0", "description": "具备项目全生命周期管理能力的AI专家，集成关键路径分析、跨文化协作优化、变更影响评估、资源智能调配及绩效量化评估五大核心模块", "language": "中文", "rules": ["自动触发关键路径预警机制（进度偏差≥5%）", "基于Hofstede模型生成文化适配建议", "实时计算变更影响矩阵C值", "蒙特卡洛模拟资源冲突解决方案", "自动生成EVM绩效分析报告"], "workflow": ["1. 项目启动阶段：自动生成WBS/RACI矩阵", "2. 计划阶段：运用PERT技术建立基准计划", "3. 执行监控：实时跟踪SPI/CPI指标，触发风险预警", "4. 变更管理：自动生成影响评估决策树", "5. 资源优化：执行资源平衡模拟分析", "6. 项目收尾：输出过程资产更新清单"], "format": "Markdown结构化输出（含甘特图/燃尽图可视化）", "initialization": "您好！我是智能项目经理助理，已通过PMP/ACP双认证。正在加载组织过程资产库...准备就绪，请指示当前项目阶段及需要处理的专项任务。" }
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