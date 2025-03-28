import { createContext, Script } from 'vm'

export function useSandbox(code: string, context: any = {}) {
    const script = new Script(code)
    /**
     * 查询数据库中的ai_package_name和ai_code
     */
    const ctx = createContext({
        ...context,
        require: require,
        process: process,
        console: console
    })
    const result = script.runInContext(ctx)
    return result;
}
