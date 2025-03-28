
import { SiliconflowChatCompletionsTool } from '@sker/core'
import { useQuery as _useQuery } from '@sker/orm'

const useQuery = async <T>(sql: string, parameters: any[]) => {
    return _useQuery<T>([], sql, parameters)
}
export async function useTools(): Promise<SiliconflowChatCompletionsTool[]> {
    return [
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

export async function runTool<T>(name: string, params: any): Promise<T> {
    switch (name) {
        case "useQuery":
            const { sql, parameters } = params
            return await useQuery<T>(sql, parameters)
        default:
            console.log({ name, parameters })
            throw new Error(`not found name: ${name}`)
    }
}
