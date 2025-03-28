import { createContext, Script } from 'vm'

export function useSandbox(code: string) {
    try {
        const script = new Script(code)
        const ctx = createContext()
        const result = script.runInContext(ctx)
        return { success: true, data: result };
    } catch (err) {
        return { success: false, error: (err as Error).message, stack: (err as Error).stack };
    }
}
