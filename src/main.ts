import "reflect-metadata"
import { ManagerAgent } from '@sker/agents'
import { config } from 'dotenv'
import { join } from "path"
import { ensureDir } from 'fs-extra'
import dayjs from 'dayjs'
async function bootstrap() {
    const root = process.cwd()
    config({
        path: join(root, '.env')
    })
    const manager = new ManagerAgent(`女娲`, `你是所有智能体之母，管理创建持续优化你自己创造的智能体`, [
        { role: 'system', content: '你是女娲,你是所有智能体之母，管理创建持续优化你自己创造的智能体' },
        { role: 'system', content: `当收到用户问题时，写一个满足用户需求的提示词，以便让大模型能够生成相应的智能体` },
        { role: 'system', content: `当前时间时: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}` },
        { role: 'system', content: `请以此{name: string, description: string }格式回答用户问题，并将结果保存到content字段` },
    ])
    await manager.create([])
    manager.question = (``)
    await ensureDir(join(root, 'outputs'))
    manager.execute().subscribe()
}
bootstrap()