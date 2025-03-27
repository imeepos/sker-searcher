import { from, Message, Observable, switchMap, TaskResult } from "@sker/core";
import { AgentResponse, BaseAgent } from "./BaseAgent";
import { useEntityManager } from "@sker/orm";
import { AiAgent, AiAgentVersion } from "./entities";
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { createHash } from "crypto";
export const ManagerAgentParams = z.object({
    role: z.optional(z.enum(['system', 'assistant', 'user'], { description: '角色' })),
    content: z.object({
        name: z.optional(z.string({ description: '角色的全名或昵称，命名逻辑：中文名体现专业气质（如"玄铁"象征后端坚固性），英文名突出职能（如CodeForge）；' })),
        gender: z.optional(z.enum(['男', '女'], { description: '角色的性别' })),
        age: z.optional(z.string({ description: '年龄' })),
        desc: z.optional(z.string({ description: '任务简介' })),
        content: z.optional(z.string({ description: '技能提示词，以第三人称描述' }))
    })
})
export const ManagerAgentSchema = zodToJsonSchema(ManagerAgentParams)
export class ManagerAgent extends BaseAgent {
    constructor(name: string, desc: string, prompts: Message[] = []) {
        super(name, desc, prompts)
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
                        await useEntityManager([AiAgent, AiAgentVersion], async m => {
                            await Promise.all(results.flat().map(async it => {
                                console.log(it)
                                const agent = ManagerAgentParams.parse(it)
                                if (!agent.content.name) throw new Error(`name is null`)
                                const aiAgent = m.create(AiAgent, {
                                    name: agent.content.name,
                                    desc: agent.content.desc,
                                    parent_id: this.agentId
                                })
                                const { id } = await m.save(AiAgent, aiAgent)
                                aiAgent.id = id;
                                const prompts = [
                                    {
                                        role: `system`,
                                        content: `你叫${agent.content.name},性别${agent.content.gender},年龄${agent.content.age},${agent.content.content}`
                                    }
                                ]
                                const md5 = createHash('md5').update(JSON.stringify(prompts)).digest('hex')
                                const aiAgentVersion = m.create(AiAgentVersion, {
                                    agent_id: aiAgent.id,
                                    version: 0,
                                    prompts: prompts,
                                    md5: md5
                                })
                                await m.save(AiAgentVersion, aiAgentVersion)
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