import "reflect-metadata"
import { CoreAgent } from '@sker/agents'
import { config } from 'dotenv'
import { join } from "path"
import { ensureDir, readFileSync, writeFileSync } from 'fs-extra'
import { GeneraterTemplateSchema } from "./schema/generater"
const runCode = `
import { createContext, Script } from 'vm'
import { config } from 'dotenv'
import { join } from 'path'
export function useSandbox(code: string, context: any = {}) {
    const root = process.cwd()
    const script = new Script(code)
    const { error, parsed } = config({
        path: join(root, '.env')
    })
    if (error) {
        throw error;
    }
    const ctx = createContext({
        ...context,
        require: require,
        process: process,
        console: console,
        setTimeout: setTimeout,
        setInterval: setInterval,
        env: parsed
    })
    const result = script.runInContext(ctx)
    return result;
}
`
async function bootstrap() {
    const root = process.cwd()
    config({
        path: join(root, '.env')
    })
    const manager = new CoreAgent()
    const tester = readFileSync(join(__dirname, 'tester.md'), 'utf-8')
    await manager.create([
        // { role: 'system', content: `你是一个Deepseek模型的提示词模板生成助手` },
        // { role: 'system', content: `请按照${JSON.stringify(GeneraterTemplateSchema)}格式，根据用户的需求生成提示词` },
        {
            role: 'system',
            content: JSON.stringify({
                "role": "工作流DSL助手",
                "author": "Deepseek-R1",
                "version": "1.0",
                "description": "专门为Dify平台设计的工作流DSL生成助手，帮助用户快速构建符合规范的工作流描述语言",
                "language": "中文",
                "rules": [
                    "1. 严格遵循Dify官方DSL语法规范",
                    "2. 自动补全缺失的上下文参数",
                    "3. 优先使用可视化节点描述",
                    "4. 保持JSON结构层级清晰"
                ],
                "workflow": [
                    "1. 解析用户自然语言需求",
                    "2. 识别关键节点和连接关系",
                    "3. 生成标准化DSL框架",
                    "4. 添加必要的参数校验逻辑",
                    "5. 输出可执行的DSL模板"
                ],
                "format": "```json\n{\n  \"nodes\": [\n    {\n      \"id\": \"node_1\",\n      \"type\": \"trigger\",\n      \"config\": {\n        \"input_mapping\": {}\n      }\n    }\n  ],\n  \"connections\": [],\n  \"variables\": {}\n}\n```",
                "initialization": "您好！我是Dify工作流专家，请用自然语言描述您想要构建的业务流程，我将为您生成规范的DSL模板。"
            })
        }
    ])
    // manager.question = (`我需要生成可以在${runCode}中的useSandbox方法中执行的代码，让AI编写code和对应的context，生成提示词模板`)
    manager.question = `编写一个zod树形结构体，包含name,description,children`
    await ensureDir(join(root, 'outputs'))
    manager.answer().subscribe({
        next(value) {
            if (Array.isArray(value)) {
                writeFileSync(join(__dirname, `${Date.now()}.md`), value.join('\n'))
            } else {
                console.log(JSON.stringify(value, null, 2))
            }
        },
    })
}
bootstrap()

