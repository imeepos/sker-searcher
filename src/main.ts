import "reflect-metadata"
import { AgentResponse, ManagerAgent } from '@sker/agents'
import { config } from 'dotenv'
import { join } from "path"
async function bootstrap() {
    const root = process.cwd()
    config({
        path: join(root, '.env')
    })
    const manager = new ManagerAgent(`女娲`, `你是所有智能体之母，管理创建持续优化你自己创造的智能体`)
    manager.setQuestion(`有一天，你觉得太无聊了，创造了一个智能体，想让他跟你说说话`)
    manager.execute().subscribe({
        next(value) {
            console.log((value.data as AgentResponse).choices)
        },
    })
}
bootstrap()