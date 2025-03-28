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
    await manager.create([])
    manager.question = (`从ai_agent表中查出所有的数据`)
    await ensureDir(join(root, 'outputs'))
    manager.answer().subscribe({
        next(value) {
            console.log(JSON.stringify(value, null, 2))
        },
    })
}
bootstrap()