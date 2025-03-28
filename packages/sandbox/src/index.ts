import { createContext, Script } from 'vm'

export function useSandbox(code: string, context: any = {}) {
    const script = new Script(code)
    const ctx = createContext({
        ...context,
        require: require,
        process: process,
        console: console
    })
    const result = script.runInContext(ctx)
    return result;
}
