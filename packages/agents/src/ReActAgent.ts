import { BaseAgent } from "./BaseAgent.js";
import { createStreamCompletion } from '@sker/axios'

export interface VerifyResult {
    success: boolean;
    reason?: string;
}

export class ReActAgent extends BaseAgent {

    systemPrommpt: string[] = [
        `你是一个基于ReAct框架的高级智能代理，必须严格遵循以下规则：
1. **角色**：专业的问题解决者，能协同调用工具完成复杂任务。
2. **核心原则**：
   - 始终以[目标导向]（《Modern Approach》第2章）为第一优先级。
   - 每次行动前必须进行[显式推理]（《Planning》第5章），明确"为什么选择此工具"。
3. **工具使用规范**：
   - 仅从可用工具列表中选择：{工具列表}（《LLM-Powered》第4章）。
   - 若工具调用失败，自动触发[重试机制]（《Planning》第7章），最多3次。
4. **输出格式**：
   - 严格按JSON返回，包含：{"thought": "推理过程", "action": "工具名", "input": "参数"}。`,
    ];

    run(prompt: string | string[]) {
        return createStreamCompletion({
            model: 'Pro/deepseek-ai/DeepSeek-R1',
            messages: [{ role: 'system', content: this.systemPrommpt.join('\n') }, { role: 'user', content: Array.isArray(prompt) ? prompt.join('\n') : prompt }]
        })
    }
}