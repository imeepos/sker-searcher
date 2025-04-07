
import { useQuery as _useQuery } from '@sker/orm'
import { useSandbox } from '@sker/sandbox'
const useQuery = async <T>(sql: string, parameters: any[]) => {
    return _useQuery<T>([], sql, parameters)
}
export async function useTools(): Promise<any[]> {
    return [
        {
            type: 'function',
            function: {
                strict: false,
                name: 'useSandbox',
                description: `Execute a javascript code with parameters in vm sandbox, 不需要return,如：code: x+y, context: {x: 1, y: 2}`,
                parameters: {
                    type: "object",
                    properties: {
                        code: {
                            type: "string",
                            description: "The javascript code to execute"
                        },
                        context: {
                            type: "object",
                            description: "The context for the javascript code to run in vm sandbox"
                        }
                    },
                    required: ["code"]
                }
            }
        },
        {
            type: 'function',
            function: {
                strict: false,
                name: "useQuery",
                description: "Execute a SQL query with parameters",
                parameters: {
                    type: "object",
                    properties: {
                        sql: {
                            type: "string",
                            description: "The SQL query to execute"
                        },
                        parameters: {
                            type: "array",
                            description: "The parameters for the SQL query",
                            items: {
                                type: "any"
                            }
                        }
                    },
                    required: ["sql", "parameters"]
                }
            }
        }
    ]
}

export async function runTool<T = any>(name: string, ...parameters: any[]): Promise<T> {
    switch (name) {
        case "useQuery":
            const { sql, params } = parameters[0]
            return await useQuery<T>(sql, params)
        case "useSandbox":
            const { code, context } = parameters[0]
            return useSandbox(code, context) as T;
        default:
            throw new Error(`not found name: ${name}`)
    }
}

