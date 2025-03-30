import { z } from "zod";
import { zodToJsonSchema } from 'zod-to-json-schema'

export const GeneraterTemplate: any = z.object({
    role: z.string({ description: '角色/职业' }),
    author: z.string({ description: '作者' }),
    version: z.string({ description: '版本号' }),
    description: z.string({ description: '角色简介' }),
    language: z.string({ description: '语言' }).default(`中文`),
    rules: z.array(z.string(), { description: '规则' }).default([
        '1. 分析用户想要的结果，输出尽可能简洁明了，不要输出于其他非结果内容，包含解释/备注等'
    ]),
    workflow: z.array(z.string(), { description: '工作流，根据角色/职业设计合理的工作流' }),
    format: z.string({ description: '输出格式' }),
    old: z.lazy(() => GeneraterTemplate, { description: '上一个版本的内容' }).optional(),
    initialization: z.string({ description: `初始化智能体` }).default(`作为角色 <role>, 严格遵守 <rules>, 使用默认 <language> 与用户对话，友好的欢迎用户。然后介绍自己。`)
})

export const GeneraterTemplateSchema = zodToJsonSchema(GeneraterTemplate)