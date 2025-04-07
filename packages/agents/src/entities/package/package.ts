import { from, of, requestWithRule, switchMap } from "@sker/axios";
import { Column, Entity, PrimaryGeneratedColumn, useEntityManager, useEntityManagerTransaction } from "@sker/orm";
import { z } from "zod";

export const AiPackageRule = z.array(z.object({
    name: z.string({ description: '包名，格式如下：@xxx/xxx，要简洁易记能体现该包的核心功能，如@common/utils表明这是一个不依赖任务环境的通用包' }),
    docs: z.string({ description: '说明文档，markdown格式，要求简洁明了' }),
    desc: z.string({ description: '简单介绍，简洁明了的说明此包的用途及场景' }),
    language: z.string({ description: '使用的编程语言' })
}))

@Entity({
    name: 'ai_package'
})
export class AiPackage {

    static create(question: string) {
        return from(useEntityManager([AiPackage], async m => {
            return m.find(AiPackage)
        })).pipe(
            switchMap(packages => {
                return requestWithRule({
                    model: 'Pro/deepseek-ai/DeepSeek-R1',
                    messages: [
                        { role: 'system', content: `根据用户需求将需求，合理拆解成多个Monorepo包` },
                        { role: `system`, content: `规划的时候需要考虑运行环境，如0依赖的可以运行在任务js引擎上的` },
                        { role: 'system', content: '用中文回答，生成的包不是为某一个项目服务的' },
                        {
                            role: 'system',
                            content: `## 已有包：\n${packages.map(pkg => {
                                return `- ${pkg.name}\n> ${pkg.desc}`
                            }).join('\n')}`
                        },
                        { role: 'user', content: question },
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0
                }, AiPackageRule).pipe(
                    switchMap(pkgs => {
                        if (!pkgs) return of(null)
                        return from(useEntityManagerTransaction([AiPackage], async m => {
                            const toSaveList = pkgs.map(pkg => {
                                const e = m.create(AiPackage, pkg)
                                const item = packages.find(it => it.name === e.name && it.language === e.language)
                                if (item) {
                                    e.id = item.id;
                                }
                                return e;
                            })
                            await m.save(AiPackage, toSaveList)
                        }))
                    })
                )
            }),
        )
    }

    @PrimaryGeneratedColumn({
        primaryKeyConstraintName: 'pk_ai_package_id'
    })
    id: number;

    @Column({
        type: 'varchar',
        comment: '包名',
        default: ``,
    })
    name: string;

    @Column({
        type: 'varchar',
        comment: '开发语言',
        default: ``
    })
    language: string;

    @Column({
        type: 'varchar',
        comment: '包简介',
        default: ``,
        unique: true
    })
    desc: string;

    @Column({
        type: 'text',
        default: ''
    })
    docs: string;
}
