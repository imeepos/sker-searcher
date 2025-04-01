import "reflect-metadata"
import { request, from, switchMap } from "@sker/axios";
import { config } from 'dotenv'
import { dirname, join } from "path"
import { z } from "zod";
import { ensureDirSync, writeFileSync } from "fs-extra";
async function bootstrap() {
    const root = process.cwd()
    config({
        path: join(root, '.env')
    })
    const input = z.array(z.object({
        filename: z.string({ description: '文件名，每个文件职责尽可能单一' }),
        doc: z.string({ description: '开发文档，用简洁的语言描述使用场景及使用方法' }),
        code: z.string({ description: '代码内容' }),
    }))

    const pythonRule: any = z.array(z.object({
        category: z.string({ description: '规范分类' }),
        content: z.string({ description: '规范内容' }),
        children: z.lazy(() => pythonRule, { description: '下级规范' })
    }))
    request({
        model: 'Pro/deepseek-ai/DeepSeek-R1',
        messages: [
            { role: 'user', content: `帮我生成一份UI设计规范` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
    }, pythonRule).subscribe({
        next(value: any) {
            console.log(`\n---------------\n`)
            const root = join(process.cwd(), 'output')
            const docFilePath = join(root, `docs.md`)
            ensureDirSync(dirname(docFilePath))
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
