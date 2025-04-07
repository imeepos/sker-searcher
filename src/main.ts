import "reflect-metadata"

import { config } from 'dotenv'
import { join } from "path";
async function bootstrap() {
    const root = process.cwd()
    config({
        path: join(root, '.env')
    })
}
bootstrap()