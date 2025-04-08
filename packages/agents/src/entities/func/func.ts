import { request } from "@sker/axios";
import { from, switchMap } from "@sker/axios";
import { Column, Entity, PrimaryGeneratedColumn, useEntityManagerTransaction } from "@sker/orm";
import { z } from "zod";
import { AiAgent } from "../agent/agent.js";

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
    code: z.string({ description: '根据用户的需求生成函数完整代码，如无必要，务增依赖' })
})

@Entity({
    name: 'ai_func'
})
export class AiFunc {

    static create(name: string, desc: string) {
        return AiAgent.use(name, desc, AiFuncRule).pipe(
            switchMap(val => {
                return from(useEntityManagerTransaction([AiFunc], async m => {
                    const e = m.create(AiFunc, val)
                    const item = await m.findOne(AiFunc, { where: { name: e.name } })
                    if (item) {
                        e.id = item.id;
                    }
                    await m.save(AiFunc, e)
                    return e;
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
        type: 'varchar',
        comment: '开发语言',
        default: ``
    })
    language: string;
}