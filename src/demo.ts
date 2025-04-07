import "reflect-metadata"
import { config } from 'dotenv'
import { join } from "path";
import { AiAgent } from '@sker/agents'
async function main() {
    const root = process.cwd()
    config({
        path: join(root, '.env')
    })
    // AiAgent.upgrades().subscribe()
    AiAgent.create(``, `创建一个视频剪辑Electron/React桌面软件开发智能体`).subscribe()
    // const mq = `

    //     `
    // AiAgent.use('RabbitArchitect', mq).subscribe({
    //     next: (val: any) => {
    //         console.log(val)
    //     }
    // })
}
main()
