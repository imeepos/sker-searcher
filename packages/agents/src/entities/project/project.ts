import { from, of, requestWithRule, switchMap } from "@sker/axios";
import { Column, Entity, PrimaryGeneratedColumn, useEntityManager, useEntityManagerTransaction } from "@sker/orm";
import { z } from "zod";
export const AiProjectRule = z.object({
    name: z.optional(z.string({ description: '项目名，要简洁易记且能体现该项目的核心亮点功能' })),
    content: z.string({ description: '详细介绍，markdown格式' }),
    desc: z.string({ description: '简单介绍，简洁明了的说明此项目的用途及场景' })
})
@Entity({
    name: 'ai_project'
})
export class AiProject {

    static create(question: string) {
        return from(useEntityManager([AiProject], async m => {
            return m.find(AiProject)
        })).pipe(
            switchMap(packages => {
                return requestWithRule({
                    model: 'Pro/deepseek-ai/DeepSeek-V3',
                    messages: [
                        {
                            role: 'system', content: `根据用户的需求，生成项目信息，包含 项目名，详细介绍，简单介绍`
                        },
                        {
                            role: 'system',
                            content: `## 已有项目：\n${packages.map(pkg => {
                                return `- ${pkg.name}\n> ${pkg.desc}`
                            }).join('\n')}`
                        },
                        { role: 'user', content: question },
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0
                }, AiProjectRule).pipe(
                    switchMap(pkgs => {
                        if (!pkgs) return of(null)
                        return from(useEntityManagerTransaction([AiProject], async m => {
                            const e = m.create(AiProject, pkgs)
                            const item = packages.find(it => it.name === e.name)
                            if (item) {
                                e.id = item.id;
                            }
                            await m.save(AiProject, e)
                        }))
                    })
                )
            }),
        )
    }

    @PrimaryGeneratedColumn({
        primaryKeyConstraintName: 'pk_ai_project_id'
    })
    id: number;

    @Column({
        type: 'varchar',
        length: 255
    })
    name: string;

    @Column({
        type: 'text',
        default: ''
    })
    desc: string;

    @Column({
        type: 'text',
        default: ''
    })
    content: string;
}