import { config } from 'dotenv'
import { join } from "path";
import { bootstrap } from '@sker/gateway'
async function main() {
    const root = process.cwd()
    config({
        path: join(root, '.env')
    })
    await bootstrap(8089)
}
main()
