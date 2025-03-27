import { Agent, from, map, Message, Observable, SiliconflowChatCompletions, SiliconflowChatCompletionsResponse, switchMap, TaskResult } from "@sker/core";
import { useEntityManager } from "@sker/orm";
import { AiAgent, AiAgentError, AiAgentLog, AiAgentVersion } from "./entities";
import { createHash } from "crypto";
import { useTools } from '@sker/tools';

export type AgentResponse = SiliconflowChatCompletionsResponse & {
    agent_id: number;
    version_id: number;
}
export class BaseAgent extends Agent<AgentResponse> {
    public chatCompletions: SiliconflowChatCompletions;
    public agentId: number;
    public versionId: number;
    public logId: number;
    constructor(name: string, desc: string, prompts: Message[] = []) {
        super(name, desc, prompts)
    }
    static async create(id: number) {
        return await useEntityManager([AiAgent, AiAgentVersion], async (m) => {
            const agent = await m.findOneOrFail(AiAgent, { where: { id: id } })
            return new BaseAgent(agent.name, agent.desc, [])
        })
    }
    async create(prompts: Message[]) {
        await useEntityManager([AiAgent, AiAgentVersion], async m => {
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
            let agentVersion = await m.findOne(AiAgentVersion, { where: { agent_id: agent.id }, order: { version: 'desc' } })
            if (!agentVersion) {
                agentVersion = m.create(AiAgentVersion, {
                    agent_id: agent.id,
                    version: 0,
                    prompts: [
                        { role: 'system', content: `你是${this.name},${this.desc}` },
                        ...this.prompts,
                        ...prompts
                    ]
                })
                const { id } = await m.save(AiAgentVersion, agentVersion)
                agentVersion.id = id;
            } else {
                const currentPrompts = [
                    { role: 'system', content: `你是${this.name},${this.desc}` },
                    ...this.prompts,
                    ...prompts
                ]
                const md5 = createHash('md5').update(JSON.stringify(currentPrompts)).digest('hex')
                if (md5 !== agentVersion.md5) {
                    const entity = m.create(AiAgentVersion, {
                        version: agentVersion.version + 1,
                        md5: md5,
                        prompts: [
                            { role: 'system', content: `你是${this.name},${this.desc}` },
                            ...this.prompts,
                            ...prompts
                        ]
                    })
                    await m.update(AiAgentVersion, agentVersion.id, entity)
                }
            }
        })
    }
    run(): Observable<AgentResponse> {
        return from(useEntityManager([AiAgent, AiAgentVersion], async m => {
            let agent = await m.findOneOrFail(AiAgent, { where: { name: this.name } })
            this.agentId = agent.id;
            let version = await m.findOneOrFail(AiAgentVersion, { where: { agent_id: agent.id }, order: { version: 'desc' } })
            this.versionId = version.id;
            const tools = await useTools()
            return { version, tools };
        })).pipe(
            switchMap(({ version, tools }) => {
                this.chatCompletions = new SiliconflowChatCompletions({
                    model: 'Pro/deepseek-ai/DeepSeek-R1',
                    messages: version?.prompts || [],
                    temperature: 0,
                    max_tokens: 16384,
                    n: 1,
                    response_format: {
                        type: 'json_object'
                    },
                    tools: [
                        ...tools
                    ]
                })
                return this.chatCompletions.run({
                    messages: [
                        { role: 'user', content: this.question }
                    ]
                }).pipe(
                    map(msg => {
                        return {
                            ...msg,
                            agent_id: version.agent_id,
                            version_id: version.id
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
                        const log = m.create(AiAgentError, {
                            prompts: this.chatCompletions.getConfig().data?.messages || [],
                            errors: [{
                                message: data.message,
                                stack: data.stack,
                                name: data.name
                            }]
                        })
                        const { id } = await m.save(AiAgentLog, log)
                        log.id = id;
                        this.logId = log.id
                    } else {
                        const log = m.create(AiAgentLog, {
                            agent_id: data.agent_id,
                            version_id: data.version_id,
                            prompts: this.chatCompletions.getConfig().data?.messages || [],
                            answer: data.choices
                        })
                        const { id } = await m.save(AiAgentLog, log)
                        log.id = id;
                        this.logId = log.id
                    }
                    return t;
                }))
            })
        )
    }
}