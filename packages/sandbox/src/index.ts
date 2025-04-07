import { createContext, Script } from 'vm'

export function useSandbox(code: string, context: any = {}) {
    const root = process.cwd()
    const script = new Script(code)
    const ctx = createContext({
        ...context,
        process: process,
        console: console,
        setTimeout: setTimeout,
        setInterval: setInterval,
        root: root
    })
    const result = script.runInContext(ctx)
    return result;
}
