import { from, Message, Observable, switchMap, TaskResult } from "@sker/core";
import { AgentResponse, BaseAgent } from "./BaseAgent";
import { useEntityManager } from "@sker/orm";
import { AiAgent, AiAgentVersion, AiCode, AiPackageName } from "./entities";
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
export const MonoreporAgentParams = z.object({
    packages: z.array(z.object({
        name: z.optional(z.string({ description: '包名，格式如下：@xxx/xxx，要简洁易记能体现该包的核心功能' })),
        docs: z.string({ description: '说明文档，markdown格式，要求简洁明了' }),
        desc: z.string({ description: '简单介绍，简洁明了的说明此包的用途及场景' })
    }))
})
export const MonoreporAgentSchema = zodToJsonSchema(MonoreporAgentParams)
export class MonoreporAgent extends BaseAgent {
    constructor(name: string, desc: string, prompts: Message[] = []) {
        super(name, desc, prompts)
    }
    static async create(id: number) {
        return await useEntityManager([AiAgent, AiAgentVersion], async (m) => {
            const agent = await m.findOneOrFail(AiAgent, { where: { id: id } })
            return new MonoreporAgent(agent.name, agent.desc, [])
        })
    }
    async create(prompts: Message[]): Promise<void> {
        const pkgPrompts = await useEntityManager([AiPackageName], async m => {
            const packages = await m.find(AiPackageName, {})
            return {
                role: 'system',
                content: `## 已有包：\n${packages.map(pkg => {
                    return `- ${pkg.name}\n> ${pkg.desc}`
                }).join('\n')}`
            } as Message
        })
        return super.create([
            pkgPrompts,
            { role: 'system', content: `根据用户的需求，参考已有包信息，如无必要，不增新包` },
            ...prompts
        ])
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
                                const agents = MonoreporAgentParams.parse(it)
                                await Promise.all(agents.packages.map(async agent => {
                                    // 保存代码
                                    const one = await m.findOne(AiPackageName, { where: { name: agent.name } })
                                    if (!one) {
                                        const code = m.create(AiPackageName, {
                                            name: agent.name,
                                            desc: agent.desc,
                                            docs: agent.docs,
                                        })
                                        await m.save(AiPackageName, code)
                                    }
                                }))
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