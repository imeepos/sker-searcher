import { Column, Entity, PrimaryGeneratedColumn, useEntityManagerTransaction } from "@sker/orm";
import { z } from "zod";
import { from, request, switchMap } from '@sker/axios'
export interface AiRuleItem {
    title: string;
    content: string;
    children: AiRuleItem[];
}
const AiRuleContent: any = z.object({
    title: z.string({ description: '规范名称，不少于3个字符，不大于128字符' }).min(3).max(128),
    content: z.string({ description: '规范内容，不少于6个字符，不大于256字符' }).min(6).max(256),
    children: z.lazy(() => z.array(AiRuleContent), { description: '下级规范' })
})
export const AiRuleSchema = z.object({
    title: z.string({ description: '规则名，不少于3个字符，不大于128字符' }).min(3).max(128),
    desc: z.string({ description: '规则简介，不少于6个字符，不大于256字符' }).min(6).max(256),
    content: z.array(AiRuleContent, { description: `规则内容` })
})
@Entity({
    name: 'ai_rule'
})
export class AiRule {

    static create(title: string, desc: string) {
        return from(useEntityManagerTransaction([AiRule], async m => {
            return m.findOne(AiRule, { where: { title: title } })
        })).pipe(
            switchMap(rule => {
                if (rule) {
                    return request({
                        model: 'Pro/deepseek-ai/DeepSeek-V3',
                        messages: [
                            { role: 'system', content: `历史信息如下：${JSON.stringify(rule.content)}` },
                            { role: 'system', content: `参考历史信息及用户输入，升级优化规则内容` },
                            { role: 'user', content: desc },
                        ],
                        response_format: { type: 'json_object' },
                        temperature: 0.3
                    }, AiRuleSchema)
                }
                return request({
                    model: 'Pro/deepseek-ai/DeepSeek-V3',
                    messages: [
                        { role: 'user', content: desc },
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.3
                }, AiRuleSchema)
            }),
            switchMap(val => {
                return from(useEntityManagerTransaction([AiRule], async m => {
                    const e = m.create(AiRule, val)
                    const item = await m.findOne(AiRule, { where: { title: e.title } })
                    if (item) {
                        e.id = item.id;
                    }
                    await m.save(AiRule, e)
                }))
            })
        )
    }

    @PrimaryGeneratedColumn({
        primaryKeyConstraintName: 'pk_ai_rule_id'
    })
    id: number;

    @Column({
        type: 'varchar',
        length: 128,
        unique: true
    })
    title: string;

    @Column({
        type: 'varchar',
        length: 256
    })
    desc: string;

    @Column({
        type: 'jsonb'
    })
    content: AiRuleItem[];
}
