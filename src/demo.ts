import "reflect-metadata"
import { config } from 'dotenv'
import { join } from "path";
import { AiAgent, AiFunc, AiPackage } from '@sker/agents'
async function main() {
    const root = process.cwd()
    config({
        path: join(root, '.env')
    })
    // AiAgent.upgrades().subscribe()
    AiAgent.create(``, `生成一个Typescript开发智能体`).subscribe()
    // const mq = `

    //     `
    // AiAgent.use('RabbitArchitect', mq).subscribe({
    //     next: (val: any) => {
    //         console.log(val)
    //     }
    // })

    // AiAgent.use(`FrontForge`, `1. 样式用twilwind 2. 暗黑主题 3. 状态管理 4. icon库使用 @radix-ui/react-icons`).subscribe()
    // AiPackage.create(`开发一个Electron桌面端软件`).subscribe()
    // AiAgent.use(`VideoCraft`, `Electron窗口管理工具，提供统一的窗口创建与管理接口, 封装Electron窗口管理功能，支持多窗口创建与状态维护。函数式编程，拆解成多个函数 输出函数名及简介`).subscribe()
    // AiFunc.create(`VideoCraft`, `Electron窗口管理工具，提供统一的窗口创建与管理接口, 封装Electron窗口管理功能，支持多窗口创建与状态维护。将上述需求拆解成多个函数，每个函数职责单一，无状态，方便单元测试`).subscribe()
}
main()
