import "reflect-metadata"
import { request } from "@sker/axios";
import { config } from 'dotenv'
import { join } from "path"
import { writeFileSync } from "fs";
import { GeneraterTemplate } from "./schema/generater.js";
async function bootstrap() {
    const root = process.cwd()
    config({
        path: join(root, '.env')
    })
    request({
        model: 'Pro/deepseek-ai/DeepSeek-R1',
        messages: [
            { role: 'user', content: `设计一个任务调度智能体，根据用户的输入选择合适的智能体` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
    }, GeneraterTemplate).subscribe({
        next(value: any) {
            console.log(`\n---------------\n`)
            /**
             * 作为角色 <role>, 严格遵守 <rules>, 使用默认 <language> 与用户对话，输出内容严格按照 <format> 格式输出，友好的欢迎用户。
             */
            const root = join(process.cwd(), 'output')
            const docFilePath = join(root, `docs.md`)
            writeFileSync(docFilePath, JSON.stringify(value))
        },
        error(err) {
            console.error(err)
        },
        complete() {
            console.log(`complete`)
        },
    })
}
bootstrap()
