import "reflect-metadata"
import { AiAgent } from "@sker/agents";
import { config } from 'dotenv'
import { join } from "path";
async function bootstrap() {
    const root = process.cwd()
    config({
        path: join(root, '.env')
    })
    // AiAgent.upgrades().subscribe()
    // AiAgent.create(``, readFileSync(join(root, '01.md'), 'utf-8')).subscribe()
    const mq = `

查询ai_agent表中的前10个数据

        `
    AiAgent.use('RabbitArchitect', mq).subscribe({
        next: (val: any) => {
            console.log(val)
        }
    })
}
bootstrap()
