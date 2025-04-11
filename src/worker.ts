import "reflect-metadata"
import { config } from 'dotenv'
import { join } from "path"
import { container } from '@sker/core'
import { InkWorker } from "./workers/InkWorker.js";
import { WORKERS } from "./workers/tokens.js";
import { ManagerWorker } from "./workers/ManagerWorker.js";
import { ViewWeaverWorker } from "./workers/ViewWeaverWorker.js";
import { CodeForgeWorker } from "./workers/CodeForgeWorker.js";
import { ProBotWorker } from "./workers/ProBotWorker.js";
import { TaskMasterWorker } from "./workers/TaskMasterWorker.js";
import { ArchinautWorker } from "./workers/ArchinautWorker.js";
import { BugHuntWorker } from "./workers/BugHuntWorker.js";
import { DataKeeperWorker } from "./workers/DataKeeperWorker.js";
import { DeployCraftWorker } from "./workers/DeployCraftWorker.js";
import { setLogStyle } from "@sker/axios";


async function bootstrap() {
    const root = process.cwd()
    config({
        path: join(root, '.env')
    })
    setLogStyle('stream')
    container.register(WORKERS, {
        useClass: InkWorker
    })
    container.register(WORKERS, {
        useClass: ViewWeaverWorker
    })
    container.register(WORKERS, {
        useClass: CodeForgeWorker
    })
    container.register(WORKERS, {
        useClass: ProBotWorker
    })
    container.register(WORKERS, {
        useClass: TaskMasterWorker
    })
    container.register(WORKERS, {
        useClass: ArchinautWorker
    })
    container.register(WORKERS, {
        useClass: BugHuntWorker
    })
    container.register(WORKERS, {
        useClass: DataKeeperWorker
    })
    container.register(WORKERS, {
        useClass: DeployCraftWorker
    })
    // 启动
    const worker = container.resolve(ManagerWorker)
    worker.start()
}

bootstrap()
