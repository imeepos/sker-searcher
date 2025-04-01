import "reflect-metadata"
import { AiFunc } from "@sker/agents";
import { config } from 'dotenv'
import { join } from "path";
import { readFileSync } from "fs-extra";

async function bootstrap() {
    const root = process.cwd()
    config({
        path: join(root, '.env')
    })
    AiFunc.create('Typescript编程助手', readFileSync(join(__dirname, 'demo.md'), 'utf-8')).subscribe()
}
bootstrap()
