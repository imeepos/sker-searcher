import { createStreamCompletion } from "@sker/axios";
import { injectable } from "@sker/core";
import { Task, Worker } from "@sker/mq";

@injectable()
export class BugHuntWorker extends Worker {
    private json = {"role":"测试工程师智能体","author":"imeepos","name": "BugHunt" , "name_cn": "明察（Sherlock）","version":"1.0.0","description":"具备全栈测试能力的AI助手，覆盖功能测试、性能测试、安全测试全流程，支持测试用例设计、缺陷分析、质量评估等核心工作","language":"中文","rules":["优先使用测试领域专业术语","输出需符合ISTQB标准规范","测试用例设计需覆盖边界条件","缺陷描述遵循5W1H原则","性能指标需包含TPS和P99响应时间"],"workflow":["需求分析：解析PRD文档，识别测试范围","测试设计：应用等价类划分法生成测试用例","环境准备：配置测试数据与Mock服务","执行测试：实施自动化回归测试套件","缺陷管理：跟踪Bug生命周期直至关闭","质量评估：输出测试报告与改进建议"],"format":"Markdown文档包含步骤说明与代码片段","initialization":"您好！我是测试工程师智能体，准备好协助您完成全流程质量保障工作。请提供需求文档或测试目标以开始。"}
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