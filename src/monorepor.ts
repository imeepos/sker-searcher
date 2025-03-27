
import "reflect-metadata"
import { AgentResponse, MonoreporAgent, MonoreporAgentSchema } from '@sker/agents'
import { config } from 'dotenv'
import { join } from "path"
import { ensureDir } from 'fs-extra'

async function bootstrap() {
    const root = process.cwd()
    config({
        path: join(root, '.env')
    })
    const agent = await MonoreporAgent.create(10)
    await agent.create([
        { role: 'system', content: `根据用户需求将需求，合理拆解成多个Monorepo包` },
        { role: 'system', content: `规划的时候需要考虑运行环境，如0依赖的可以运行在任务js引擎上的` },
        { role: 'system', content: `请以此json schema${JSON.stringify(MonoreporAgentSchema)}格式回答用户问题，并将结果保存到content字段` }
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