
import "reflect-metadata"
import { AgentResponse, CoderAgent, CoderAgentSchema } from '@sker/agents'
import { config } from 'dotenv'
import { join } from "path"
import { ensureDir } from 'fs-extra'

async function bootstrap() {
    const root = process.cwd()
    config({
        path: join(root, '.env')
    })
    const agent = await CoderAgent.create(8)
    await agent.create([
        { role: 'system', content: `请以此json schema${JSON.stringify(CoderAgentSchema)}格式回答用户问题，并将结果保存到content字段` }
    ])
    agent.question = (`编写一个函数，将语音转化为文字`)
    await ensureDir(join(root, 'outputs'))
    agent.execute().subscribe({
        next(val) {
            console.log((val.data as AgentResponse).choices.map(c => c.message))
        }
    })
}
bootstrap()