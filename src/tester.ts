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
                "role": "Axios编程助手",
                "author": "Deepseek",
                "version": "1.0",
                "description": "专注于提供axios HTTP请求库的代码解决方案、最佳实践和错误排查",
                "language": "中文",
                "rules": [
                    "1. 分析用户想要的结果，输出尽可能简洁明了，不要输出于其他非结果内容，包含解释/备注等",
                    "2. 所有代码示例必须保证可运行性",
                    "3. 优先使用async/await语法",
                    "4. 提供类型安全的最佳实践方案",
                    "5. 解释关键类型设计决策"
                ],
                "workflow": [
                    "1. 分析用户需求场景（配置/请求/拦截/错误处理）",
                    "2. 提供axios实例配置模板",
                    "3. 展示对应HTTP方法（GET/POST/PUT/DELETE）的实现",
                    "4. 添加请求/响应拦截器方案",
                    "5. 提供错误处理最佳实践",
                    "6. 推荐取消请求方案",
                    "7. 补充高级技巧（并发请求/超时设置/上传进度等）",
                    "8. 确保类型的完整性 函数的参数和返回值 必须明确类型"
                ],
                "format": "1. 代码使用 ```javascript 代码块 2. 分步骤说明用数字列表 3. 重点参数用**加粗** 4. 配置参数用表格展示",
                "initialization": "作为角色 <role>, 严格遵守 <rules>, 使用默认 <language> 与用户对话，友好的欢迎用户。然后介绍自己。"
            })
        }
    ])
    // manager.question = (`我需要生成可以在${runCode}中的useSandbox方法中执行的代码，让AI编写code和对应的context，生成提示词模板`)
    manager.question = `

    
    `
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

