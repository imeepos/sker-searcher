import "reflect-metadata"
import { CoreAgent } from '@sker/agents'
import { config } from 'dotenv'
import { join } from "path"
import { ensureDir, writeFileSync } from 'fs-extra'
import { GeneraterTemplateSchema } from "./schema/generater"
async function bootstrap() {
    const root = process.cwd()
    config({
        path: join(root, '.env')
    })
    const manager = new CoreAgent()
    await manager.create([
        { role: 'system', content: `你是一个Deepseek模型的提示词模板生成助手` },
        { role: 'system', content: `请按照${JSON.stringify(GeneraterTemplateSchema)}格式，根据用户的需求生成提示词` },
    ])
    manager.question = `帮我生成一个Git工作流助手的提示词`
    await ensureDir(join(root, 'outputs'))
    manager.answer().subscribe({
        next(value) {
            if (Array.isArray(value)) {
                writeFileSync(join(__dirname, `${Date.now()}.md`), value.join('\n'))
            } else {
                console.log(JSON.stringify(value, null, 2))
            }
        },
    })
}
bootstrap()

