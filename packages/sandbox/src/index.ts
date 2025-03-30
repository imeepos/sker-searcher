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
