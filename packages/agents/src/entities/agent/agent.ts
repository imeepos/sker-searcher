import { createPrompts, mergeMap, MODELS, requestWithRule } from "@sker/axios";
import { createStreamCompletion, from, of, switchMap } from "@sker/axios";
import { Column, CreateDateColumn, Entity, Not, PrimaryGeneratedColumn, UpdateDateColumn, useEntityManagerTransaction } from "@sker/orm";
import { z, ZodType } from "zod";

export const AiAgentRule = z.object({
    name: z.string({ description: '智能体的英文名字, 英文名突出技能以及职能（如CodeForge）' }),
    title: z.string({ description: '智能体的中文名字, 体现专业气质及职能和技能（如"玄铁"象征后端坚固性）' }),
    desc: z.string({ description: '智能体的简介，介绍一下主要负责什么工作' }),
})

@Entity({
    name: 'ai_agent'
})
export class AiAgent {
    static use<T>(name: string, question: string, rule?: ZodType<T>) {
        return from(useEntityManagerTransaction([AiAgent], async m => {
            return m.findOneOrFail(AiAgent, { where: { name: name } })
        })).pipe(
            switchMap(agent => {
                if (rule) {
                    return requestWithRule({
                        model: (agent.model || 'Pro/deepseek-ai/DeepSeek-V3') as MODELS,
                        messages: [
                            ...agent.prompts,
                            { role: 'user', content: question },
                        ],
                        response_format: { type: 'json_object' },
                        temperature: parseFloat(`${(agent.temperature || 30) / 100}`)
                    }, rule)
                }
                return createStreamCompletion<T>({
                    model: 'Pro/deepseek-ai/DeepSeek-V3',
                    messages: [
                        ...agent.prompts,
                        { role: 'user', content: question },
                    ],
                    response_format: { type: 'text' },
                    temperature: 0.3
                })
            })
        )
    }
    static create(name: string, desc: string) {
        return requestWithRule({
            model: 'Pro/deepseek-ai/DeepSeek-V3',
            messages: [
                { role: 'user', content: desc },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7
        }, AiAgentRule).pipe(
            switchMap(val => {
                return from(useEntityManagerTransaction([AiAgent], async m => {
                    const parentAgent = await m.findOne(AiAgent, { where: { name: name } })
                    const e = m.create(AiAgent, val)
                    const item = await m.findOne(AiAgent, { where: { name: e.name } })
                    if (item) {
                        e.id = item.id;
                    }
                    if (parentAgent) {
                        e.parent_id = parentAgent.id
                    }
                    await m.save(AiAgent, e)
                    return e;
                }))
            }),
            switchMap(agent => {
                return createPrompts({
                    model: 'Pro/deepseek-ai/DeepSeek-V3',
                    messages: [
                        { role: 'user', content: agent.desc },
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.3
                }).pipe(
                    switchMap(prompts => {
                        return from(useEntityManagerTransaction([AiAgent], async m => {
                            await m.update(AiAgent, agent.id, { prompts: prompts.messages as any[], model: prompts.model, temperature: prompts.temperature * 100 })
                        }))
                    })
                )
            }),
        )
    }
    static upgrade(name: string, question: string) {
        return from(useEntityManagerTransaction([AiAgent], async m => {
            return m.findOneOrFail(AiAgent, { where: { name: name } })
        })).pipe(
            switchMap(agent => {
                if (agent) {
                    return createPrompts({
                        model: 'Pro/deepseek-ai/DeepSeek-V3',
                        messages: [
                            { role: 'user', content: question },
                        ],
                        response_format: { type: 'json_object' },
                        temperature: 0.7
                    }).pipe(
                        switchMap(prompts => {
                            return from(useEntityManagerTransaction([AiAgent], async m => {
                                await m.update(AiAgent, agent.id, { prompts: prompts.messages as any[], model: prompts.model, temperature: prompts.temperature * 100 })
                            }))
                        })
                    )
                }
                return of(null)
            })
        )
    }
    static upgrades() {
        return from(useEntityManagerTransaction([AiAgent], async m => {
            return m.find(AiAgent, { where: { parent_id: Not(0) } })
        })).pipe(
            switchMap(agents => from(agents)),
            mergeMap(agent => {
                return AiAgent.upgrade(agent.name, agent.desc)
            })
        )
    }
    @PrimaryGeneratedColumn({
        primaryKeyConstraintName: 'pk_ai_agent_id'
    })
    id: number;

    @Column({
        name: 'name',
        type: 'varchar',
        length: 64,
        default: ''
    })
    name: string;

    @Column({
        name: 'title',
        type: 'varchar',
        length: 128,
        default: ''
    })
    title: string;

    @Column({
        name: 'desc',
        type: 'varchar',
        length: 255,
        default: ``
    })
    desc: string;

    @Column({
        type: 'int',
        default: 0
    })
    parent_id: number;

    @Column({
        type: 'jsonb',
        nullable: true
    })
    prompts: any[]

    @Column({
        type: 'varchar',
        length: 128,
        default: ''
    })
    model: string;

    @Column({
        type: 'int',
        default: 0
    })
    temperature: number;

    @CreateDateColumn()
    create_date: Date;

    @UpdateDateColumn()
    update_date: Date;
}