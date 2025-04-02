import "reflect-metadata"
import { AiAgent } from "@sker/agents";
import { config } from 'dotenv'
import { join } from "path";
import { readFileSync } from "fs-extra";
async function bootstrap() {
    const root = process.cwd()
    config({
        path: join(root, '.env')
    })

    AiAgent.use(`TypeForge`, readFileSync(join(__dirname, 'demo.md'), 'utf-8')).subscribe()
}
bootstrap()
