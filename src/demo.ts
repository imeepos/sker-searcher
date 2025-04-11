import "reflect-metadata"
import { config } from 'dotenv'
import { join } from "path";
import { BaseAgent, PlanningReActAgent, RedisPlanningFlow, AiAgent } from '@sker/agents'
import { createStreamCompletion, setLogStyle, requestWithRule, retry, switchMap, from } from '@sker/axios'
import { TaskRule } from "./flow/planning.js";
import { readFileSync, writeFileSync } from "fs";
import { writeFile } from "fs/promises";
import { SYSTEM_PROMPT, CHECK_PROMPTS } from './资深前端架构师.js'

export interface VerifyResult {
    success: boolean;
    reason?: string;
}

export class ReActAgent extends BaseAgent {

    systemPrommpt: string[] = [
        `你是一个基于ReAct框架的高级智能代理，必须严格遵循以下规则：
1. **角色**：专业的问题解决者，能协同调用工具完成复杂任务。
2. **核心原则**：
   - 始终以[目标导向]为第一优先级。
   - 每次行动前必须进行[显式推理]，明确"为什么选择此工具"。
3. **工具使用规范**：
   - 仅从可用工具列表中选择：{工具列表}。
   - 若工具调用失败，自动触发[重试机制]，最多3次。
4. **输出格式**：
   - 严格按JSON返回，包含：{"thought": "推理过程", "action": "工具名", "input": "参数"}。
5. 禁止假设工具不存在的能力，若不确定工具功能，必须查询文档。
   `,
    ];


    planPrompt: string[] = [
        "你是一个计划助手。创建一个简洁、可执行的计划，包含清晰的步骤。",
        "关注关键里程碑而非详细子步骤。",
        "优先考虑清晰度和效率。"
    ]

    stepPrompt: string[] = [
        `当前任务：{用户输入}
历史步骤：{步骤历史}

请按以下流程执行：
1. **状态分析**（：
   - 当前是否已满足任务目标？若是，直接返回结果。
   - 若否，列出剩余待解决的子问题。
2. **工具匹配**：
   - 对每个子问题，从可用工具中匹配最优解，需说明选择依据。
   - 示例："子问题A需要数据清洗 → 选择Python工具（因需代码执行）"
3. **风险检查**：
   - 预判工具调用的可能失败点（如参数缺失、超限等）。
   - 若有风险，提出备选方案。
4. **输出**：生成严格的JSON指令，无自由文本。
5. 需验证结果是否推进了主任务目标。
6. 若任务涉及时序（如A必须在B前执行），需显式声明依赖关系。
`
    ]

    errorPrompt: string[] = [
        `⚠️ 工具调用失败：{错误信息}
当前状态：{环境状态}

请按以下步骤恢复：
1. **诊断**：明确失败原因（参数错误/工具不可用/逻辑冲突）。
2. **调整**：
   - 若参数错误：重新生成输入，避免相同错误。
   - 若工具不可用：选择功能相似的替代工具。
3. **回退**：如多次失败，返回人类可理解的错误摘要，包含：
   - 已尝试的方案
   - 失败的根本原因
   - 需要的具体帮助`
    ]


    plan(prompt: string[]) {
        return requestWithRule({
            model: 'Pro/deepseek-ai/DeepSeek-R1',
            temperature: 0.3,
            response_format: { type: 'json_object' },
            messages: [{ role: 'system', content: this.planPrompt.join('\n') }, { role: 'user', content: `创建一个合理的计划，包含清晰的步骤来完成这个任务：${prompt.join('\n')}` }, { role: 'user', content: '重要提醒：请务必保证依赖的任务ID是存在的' }]
        }, TaskRule).pipe(
            retry(3)
        )
    }

    run(prompt: string | string[]) {
        return createStreamCompletion({
            model: 'Pro/deepseek-ai/DeepSeek-R1',
            temperature: 0.3,
            response_format: { type: 'json_object' },
            messages: [{ role: 'system', content: this.systemPrommpt.join('\n') }, { role: 'user', content: Array.isArray(prompt) ? prompt.join('\n') : prompt }]
        })
    }
}
async function main() {
    const root = process.cwd()
    config({
        path: join(root, '.env')
    })
    setLogStyle('stream')
    // AiProject.create(`一款专注于主播打点标注的桌面端软件`).subscribe()


    // const plan = new PlanningReActAgent()
    // plan.plan(1)

    // const planing = new RedisPlanningFlow({})
    // planing.start(1)

    // AiAgent.use(`TypeForge`, readFileSync(join(root, 'src', 'demo.md'), 'utf-8')).subscribe({
    //     next(value) {
    //         writeFileSync(join(root, 'output', 'demo.md'), typeof value === 'string' ? value : JSON.stringify(value))
    //     },
    // })
    const system = `作为:${SYSTEM_PROMPT.join('\n')}`
    const input = readFileSync(join(root, 'tests/001/input.md'), 'utf-8')
    createStreamCompletion({
        model: 'Pro/deepseek-ai/DeepSeek-V3',
        messages: [{ role: 'system', content: system }, { role: 'user', content: input }],
        temperature: 0
    }).pipe(
        switchMap(r => {
            return from(writeFile(join(root, 'tests/001/output.md'), r as string))
        })
    ).subscribe()
}
main()
