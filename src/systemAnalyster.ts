
import "reflect-metadata"
import { AgentResponse, SystemAnalysterAgent, SystemAnalysterAgentSchema } from '@sker/agents'
import { config } from 'dotenv'
import { join } from "path"
import { ensureDir } from 'fs-extra'

async function bootstrap() {
    const root = process.cwd()
    config({
        path: join(root, '.env')
    })
    const agent = await SystemAnalysterAgent.create(11)
    await agent.create([
        { role: 'system', content: `请以此json schema${JSON.stringify(SystemAnalysterAgentSchema)}格式回答用户问题，并将结果保存到content字段` }
    ])
    agent.question = (`我要做一个Electron客户端软件，请帮我合理规划一下`)
    await ensureDir(join(root, 'outputs'))
    agent.execute().subscribe({
        next(val) {
            console.log((val.data as AgentResponse).choices.map(c => c.message))
        }
    })
}
bootstrap()