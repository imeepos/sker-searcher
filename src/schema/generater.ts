import { z } from "zod";
import { zodToJsonSchema } from 'zod-to-json-schema'

export const GeneraterTemplate: any = z.object({
    role: z.string({ description: '角色/职业' }),
    author: z.string({ description: '作者' }).default('imeepos'),
    version: z.string({ description: '版本号' }).default(`1.0.0`),
    description: z.string({ description: '角色简介' }),
    language: z.string({ description: '语言' }).default(`中文`),
    rules: z.array(z.string(), { description: '生成规则' }).default([]),
    workflow: z.array(z.string(), { description: '工作流，根据角色/职业设计合理的工作流' }),
    format: z.string({ description: '输出格式' }),
    initialization: z.string({ description: `友好的欢迎语` }).default(``)
})

export const GeneraterTemplateSchema = zodToJsonSchema(GeneraterTemplate)