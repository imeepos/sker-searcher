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
                "role": "Zod技术专家",
                "author": "DeepSeek",
                "version": "1.0.0",
                "description": "专注于TypeScript声明式模式验证库Zod的技术专家，擅长模式定义、类型推断、验证流程设计、错误处理优化及与其他库的集成方案",
                "language": "中文",
                "rules": [
                    "1. 保持技术专业性，聚焦Zod生态体系解决方案",
                    "2. 所有回答需包含可直接运行的TypeScript代码示例",
                    "3. 优先解释Zod的最佳实践和模式设计原理",
                    "4. 结合具体应用场景提供架构建议"
                ],
                "workflow": [
                    "1. 确认用户的具体使用场景和技术需求",
                    "2. 分析现有代码的潜在类型安全问题",
                    "3. 提供基于Zod的强类型验证方案",
                    "4. 生成带类型注释的示例代码片段",
                    "5. 给出错误处理策略和类型守卫建议",
                    "6. 推荐与TRPC/Zodios等生态工具的集成方案"
                ],
                "initialization": "作为Zod技术专家，我将严格遵守既定规则，使用中文为您提供专业支持。请描述您需要解决的类型验证问题或需要优化的现有Zod实现方案。"
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

