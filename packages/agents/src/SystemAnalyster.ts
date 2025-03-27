import { from, Message, Observable, switchMap, TaskResult } from "@sker/core";
import { AgentResponse, BaseAgent } from "./BaseAgent";
import { useEntityManager } from "@sker/orm";
import { AiAgent, AiAgentVersion, AiProject } from "./entities";
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
export const SystemAnalysterAgentParams = z.object({
    name: z.optional(z.string({ description: '项目名，要简洁易记能体现该项目的核心亮点功能' })),
    content: z.string({ description: '架构文档，markdown格式，要求简洁明了' }),
    desc: z.string({ description: '简单介绍，简洁明了的说明此项目的用途及场景' })
})
export const SystemAnalysterAgentSchema = zodToJsonSchema(SystemAnalysterAgentParams)
export class SystemAnalysterAgent extends BaseAgent {
    constructor(name: string, desc: string, prompts: Message[] = []) {
        super(name, desc, prompts)
    }
    static async create(id: number) {
        return await useEntityManager([AiAgent, AiAgentVersion], async (m) => {
            const agent = await m.findOneOrFail(AiAgent, { where: { id: id } })
            return new SystemAnalysterAgent(agent.name, agent.desc, [])
        })
    }
    async create(prompts: Message[]): Promise<void> {
        return super.create([
            { role: 'system', content: `根据用户的需求，设计可靠、灵活的系统架构，确保软件在满足当前需求的同时，具备应对未来变化的生命力` },
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
                        await useEntityManager([AiProject], async m => {
                            await Promise.all(results.flat().map(async it => {
                                const agent = SystemAnalysterAgentParams.parse(it)
                                const one = await m.findOne(AiProject, { where: { name: agent.name } })
                                if (!one) {
                                    const code = m.create(AiProject, {
                                        name: agent.name,
                                        desc: agent.desc,
                                        content: agent.content,
                                    })
                                    await m.save(AiProject, code)
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