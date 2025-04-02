import { request } from "@sker/axios";
import { from, switchMap } from "@sker/axios";
import { Column, Entity, PrimaryGeneratedColumn, useEntityManagerTransaction } from "@sker/orm";
import { z } from "zod";

export interface AiFuncDep {
    name: string;
}
export const AiFuncSimpleRule = z.object({
    name: z.string({
        description: '函数名'
    })
})
export const AiFuncRule = z.object({
    name: z.string({ description: '根据用户的需求生成函数名' }),
    doc: z.string({ description: '根据用户的需求生成生成函数文档，给AI编码生成本函数的文档，尽量简洁' }),
    code: z.string({ description: '根据用户的需求生成函数完整代码，如无必要，务增依赖' }),
    deps: z.array(AiFuncSimpleRule, { description: '根据生成的函数代码，生成依赖的其他函数列表' })
})

@Entity({
    name: 'ai_func'
})
export class AiFunc {

    static create(name: string, desc: string) {
        return from(useEntityManagerTransaction([AiFunc], async m => {
            return m.findOne(AiFunc, { where: { name: name } })
        })).pipe(
            switchMap(rule => {
                if (rule) {
                    return request({
                        model: 'Pro/deepseek-ai/DeepSeek-V3',
                        messages: [
                            { role: 'system', content: `历史信息如下：${JSON.stringify(rule.code)}` },
                            { role: 'system', content: `参考历史信息及用户输入，升级优化代码内容` },
                            { role: 'user', content: desc },
                        ],
                        response_format: { type: 'json_object' },
                        temperature: 0.3
                    }, AiFuncRule)
                }
                return request({
                    model: 'Pro/deepseek-ai/DeepSeek-V3',
                    messages: [
                        { role: 'user', content: desc },
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.3
                }, AiFuncRule)
            }),
            switchMap(val => {
                return from(useEntityManagerTransaction([AiFunc], async m => {
                    const e = m.create(AiFunc, val)
                    const item = await m.findOne(AiFunc, { where: { name: e.name } })
                    if (item) {
                        e.id = item.id;
                    }
                    await m.save(AiFunc, e)
                }))
            })
        )
    }

    @PrimaryGeneratedColumn({
        primaryKeyConstraintName: 'ai_func_id'
    })
    id: number;

    @Column({
        type: 'varchar',
        length: 128
    })
    name: string;

    @Column({
        type: 'varchar',
        length: 255
    })
    doc: string;

    @Column({
        type: 'text',
    })
    code: string;

    @Column({
        type: 'jsonb'
    })
    deps: AiFuncDep[];
}