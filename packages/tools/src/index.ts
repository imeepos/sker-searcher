
import { SiliconflowChatCompletionsTool } from '@sker/core'
import { useQuery as _useQuery } from '@sker/orm'

const useQuery = async (sql: string, parameters: any[]) => {
    return _useQuery([], sql, parameters)
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

export async function runTool(name: string, parameters: any[]) {
    switch (name) {
        case "useQuery":
            const { sql, params } = parameters[0]
            return await useQuery(sql, params)
        default:
            console.log({ name, parameters })
    }
}
