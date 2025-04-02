import "reflect-metadata"
import { AiAgent } from "@sker/agents";
import { config } from 'dotenv'
import { join } from "path";
async function bootstrap() {
    const root = process.cwd()
    config({
        path: join(root, '.env')
    })
    AiAgent.upgrades().subscribe()
}
bootstrap()
