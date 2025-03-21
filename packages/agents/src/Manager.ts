import { Agent, from, isTaskResult, map, Observable, SiliconflowChatCompletions, SiliconflowChatCompletionsResponse, switchMap, TaskResult } from "@sker/core";
import { useEntityManager } from "@sker/orm";
import { AiAgent, AiAgentError, AiAgentLog, AiAgentVersion } from "./entities";
export type AgentResponse = SiliconflowChatCompletionsResponse & {
    agent_id: number;
    version_id: number;
}
export class ManagerAgent extends Agent<AgentResponse> {
    private chatCompletions: SiliconflowChatCompletions;
    constructor(name: string, desc: string) {
        super(name, desc)
    }
    run(question: string): Observable<AgentResponse> {
        return from(useEntityManager([AiAgent, AiAgentVersion], async m => {
            let agent = await m.findOne(AiAgent, { where: { name: this.name } })
            if (!agent) {
                agent = m.create(AiAgent, {
                    name: this.name,
                    desc: this.desc,
                    parent_id: 0
                });
                const { id } = await m.save(AiAgent, agent)
                agent.id = id;
            }
            let version = await m.findOne(AiAgentVersion, { where: { agent_id: agent.id }, order: { version: 'desc' } })
            if (!version) {
                version = m.create(AiAgentVersion, {
                    agent_id: agent.id,
                    version: 0,
                    prompts: []
                })
                const { id } = await m.save(AiAgentVersion, version)
                version.id = id;
            }
            return version;
        })).pipe(
            switchMap(it => {
                this.chatCompletions = new SiliconflowChatCompletions({
                    model: 'Pro/deepseek-ai/DeepSeek-R1',
                    messages: it?.prompts || [],
                    temperature: 0,
                })
                return this.chatCompletions.run({
                    messages: [
                        { role: 'user', content: question }
                    ]
                }).pipe(
                    map(msg => {
                        return {
                            ...msg,
                            agent_id: it.agent_id,
                            version_id: it.id
                        }
                    })
                )
            })
        )
    }

    execute(): Observable<TaskResult<AgentResponse>> {
        return super.execute().pipe(
            switchMap(t => {
                return from(useEntityManager([AiAgent, AiAgentVersion, AiAgentLog, AiAgentError], async m => {
                    const data = t.data;
                    if (data instanceof Error) {
                        // 错误
                        const log = m.create(AiAgentError, {
                            prompts: this.chatCompletions.getConfig().data?.messages || [],
                            errors: [{
                                message: data.message,
                                stack: data.stack,
                                name: data.name
                            }]
                        })
                        await m.save(AiAgentLog, log)
                    } else {
                        const log = m.create(AiAgentLog, {
                            agent_id: data.agent_id,
                            version_id: data.version_id,
                            prompts: this.chatCompletions.getConfig().data?.messages || [],
                            answer: data.choices
                        })
                        await m.save(AiAgentLog, log)
                    }
                    return t;
                }))
            })
        )
    }
}