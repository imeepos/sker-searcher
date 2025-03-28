import { from, Message, Observable, switchMap, TaskResult } from "@sker/core";
import { AgentResponse, BaseAgent } from "./BaseAgent";
import { useEntityManager } from "@sker/orm";
import { AiAgent, AiAgentVersion, AiCode, AiPackageName } from "./entities";
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { createHash } from "crypto";
export const TesterAgentParams = z.object({
    name: z.optional(z.string({ description: '函数名，函数名要简洁易记体现函数功能' })),
    docs: z.string({ description: 'markdown格式的说明文档，要求简洁明了' }),
    code: z.string({ description: '完整代码，如无必要，不增依赖' })
})
export const TesterAgentSchema = zodToJsonSchema(TesterAgentParams)
export class TesterAgent extends BaseAgent {
    constructor(name: string, desc: string, prompts: Message[] = []) {
        super(name, desc, prompts)
    }
    static async create(id: number) {
        return await useEntityManager([AiAgent, AiAgentVersion], async (m) => {
            const agent = await m.findOneOrFail(AiAgent, { where: { id: id } })
            return new TesterAgent(agent.name, agent.desc, [])
        })
    }
    execute(): Observable<TaskResult<AgentResponse>> {
        return super.execute().pipe(
            switchMap((value) => {
                const run = async () => {
                    const data = value.data as AgentResponse
                    const results = data.choices.map(d => {
                        try {
                            return JSON.parse(d.message.reasoning_content || '')
                        } catch (e) {
                            return {}
                        }
                    })
                    if (Array.isArray(results)) {
                        await useEntityManager([AiPackageName, AiCode], async m => {
                            await Promise.all(results.flat().map(async it => {
                                const agent = TesterAgentParams.parse(it)
                                // 保存代码
                                const md5 = createHash('md5').update(agent.code).digest('hex')
                                const one = await m.findOne(AiCode, { where: { hash: md5 } })
                                if (!one) {
                                    const code = m.create(AiCode, {
                                        name: agent.name,
                                        docs: agent.docs,
                                        code: agent.code,
                                        hash: md5
                                    })
                                    await m.save(AiCode, code)
                                }
                            }))
                        })
                    }
                    return value;
                }
                return from(run())
            })
        )
    }
}