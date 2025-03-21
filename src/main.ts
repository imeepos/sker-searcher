import "reflect-metadata"
import { ManagerAgent } from '@sker/agents'
import { config } from 'dotenv'
import { join } from "path"
async function bootstrap() {
    const root = process.cwd()
    config({
        path: join(root, '.env')
    })
    const manager = new ManagerAgent(`创世者`, `世界之处，是你创造了这个世界`)
    manager.setQuestion(`帮我介绍下strapi以及最佳实践`)
    manager.execute().subscribe({})
}
bootstrap()