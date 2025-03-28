import "reflect-metadata"
import { CoreAgent } from '@sker/agents'
import { config } from 'dotenv'
import { join } from "path"
import { ensureDir } from 'fs-extra'
async function bootstrap() {
    const root = process.cwd()
    config({
        path: join(root, '.env')
    })
    const manager = new CoreAgent()
    await manager.create([
        { role: 'system', content: `将用户需求转化为javascript代码实现` },
        { role: 'system', content: `如果需要调用工具，请按照{name: string, parameters: any[]}格式输出到content` },
    ])
    manager.question = (`将语音转化为文字`)
    await ensureDir(join(root, 'outputs'))
    manager.answer().subscribe({
        next(value) {
            console.log(JSON.stringify(value, null, 2))
        },
    })
}
bootstrap()