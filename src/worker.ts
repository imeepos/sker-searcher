import "reflect-metadata"
import { config } from 'dotenv'
import { join } from "path"
import { container } from '@sker/core'
import { InkWorker } from "./workers/InkWorker.js";
import { WORKERS } from "./workers/tokens.js";
import { ManagerWorker } from "./workers/ManagerWorker.js";

async function bootstrap() {
    const root = process.cwd()
    config({
        path: join(root, '.env')
    })
    container.register(WORKERS, {
        useClass: InkWorker
    })
    // 启动
    const worker = container.resolve(ManagerWorker)
    worker.start()
}

bootstrap()