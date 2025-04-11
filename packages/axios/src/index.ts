
import { from, map, Observable, retry, switchMap, throwError } from "rxjs";
import axios, { AxiosError } from "axios";
import { z, ZodType } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { MultiTerminalDisplay, AgentStatus } from '@sker/terminal'
import { randomUUID } from "crypto";
import { useTools } from '@sker/tools'
export * from 'rxjs'
export type MODELS =
    | `Qwen/QwQ-32B`
    | `Pro/deepseek-ai/DeepSeek-R1`
    | `Pro/deepseek-ai/DeepSeek-V3`;
// 类型定义
export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

export interface ResponseFormatJsonObject {
    type: 'json_object'
}
export interface ResponseFormatText {
    type: 'text'
}
export interface ResponseFormatJsonSchema {
    type: 'json_schema';
    json_schema: any;
}

interface ChatCompletionParams {
    messages: ChatMessage[];
    model?: MODELS;
    temperature?: number;
    response_format?: ResponseFormatJsonObject | ResponseFormatText | ResponseFormatJsonSchema;
    name?: string;
}
export interface ToolCallFunction {
    name: string;
    arguments: string;
}
export interface ToolCall {
    id: string;
    type: 'function';
    function: ToolCallFunction;
}
export interface Message {
    role: "system" | "user" | "assistant";
    content: string;
    reasoning_content?: string;
    tool_calls?: ToolCall[];
    finish_reason: 'stop' | 'eos' | 'length' | 'tool_calls';
}
interface CompletionChoice {
    index: number;
    delta: Message;
    finish_reason: "stop" | "length" | "content_filter" | "tool_calls";
}
interface StreamResponse {
    id: string;
    created: number;
    object: string;
    model: string;
    choices: Array<CompletionChoice>;
    system_fingerprint: string;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    }
}

const display = new MultiTerminalDisplay({
    width: 40,
    height: 6,
    margin: 2
});
export const Completion = z.object({
    model: z.enum([`Qwen/QwQ-32B`
        , `Pro/deepseek-ai/DeepSeek-R1`
        , `Pro/deepseek-ai/DeepSeek-V3`], { description: '分析用户需求以及每个模型的特长，选择最合适的模型，质量优先' }),
    temperature: z.number({ description: '分析用户需求，选择最合适的温度' }),
    messages: z.array(
        z.object({
            role: z.enum(["system"], { description: '角色' }),
            content: z.string({ description: '提示词，主要限定角色的技能，风格，规范，方法，思路，经验等' })
        }),
        { description: '根据用户需求，生成不少于5组提示词，尽可能多的选择不同相关视角/不同相关场景/相关边界条件提出详细要求' }
    ).min(3)
})

export const CompletionSchema = zodToJsonSchema(Completion)
function getMaxTokens(model: MODELS) {
    switch (model) {
        case 'Qwen/QwQ-32B':
            return 32768
        case 'Pro/deepseek-ai/DeepSeek-V3':
            return 8192
        case 'Pro/deepseek-ai/DeepSeek-R1':
            return 16384
        default:
            return 512
    }
}

let logStyle: 'simple' | 'stream' = 'simple'
export function setLogStyle(style: 'simple' | 'stream') {
    logStyle = style;
}

// 核心流式处理函数
export function createStreamCompletion<T>(
    params: ChatCompletionParams
): Observable<T> {
    // 创建专用 axios 实例
    const sk = process.env.SILICONFLOW_API_KEY || ''
    const sks = sk.split(',')
    const useSk = sks[Math.floor(Math.random() * sks.length)]
    const streamClient = axios.create({
        baseURL: "https://api.siliconflow.cn/v1",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${useSk}`,
        },
        responseType: "stream", // 关键配置
    });
    return from(useTools()).pipe(
        switchMap(tools => {
            return new Observable<T>((subscriber) => {
                const controller = new AbortController();
                let reasoning_content = Buffer.from(``)
                let content = Buffer.from(``)
                params.name = params.name || randomUUID()
                const response_format = params.response_format || { type: 'text' }
                const toolCallsMap: Map<string, any> = new Map()
                const onEnd = () => {
                    try {
                        if (response_format.type === 'text') {
                            subscriber.next(content.toString('utf-8') as T)
                        }
                        if (response_format.type === 'json_object') {
                            try {
                                const item = JSON.parse(reasoning_content.toString('utf-8'))
                                subscriber.next(item)
                            } catch (e) {
                                try {
                                    const item = JSON.parse(content.toString('utf-8'))
                                    subscriber.next(item)
                                } catch (e) {
                                    subscriber.next(reasoning_content.toString('utf-8') as T)
                                }
                            }
                        }
                    } catch (e) {
                        subscriber.error(e)
                    }
                    subscriber.complete()
                }
                const agent: AgentStatus = {
                    createDate: new Date(),
                    total_tokens: 0,
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    name: params.name || ``
                }
                const data = {
                    ...params,
                    stream: true,
                    max_tokens: getMaxTokens(params.model || 'Qwen/QwQ-32B'),
                    // tools: tools
                }
                streamClient
                    .request({
                        url: `/chat/completions`,
                        method: 'post',
                        data: data,
                        signal: controller.signal,
                    })
                    .then((response) => {
                        const stream = response.data;
                        // 流数据处理处理器
                        const dataHandler = (chunk: Buffer) => {
                            try {
                                const payloads = chunk.toString().split("\n\n");
                                for (const payload of payloads) {
                                    if (payload.startsWith("data:")) {
                                        const data = payload.replace(/^data: /, "");
                                        if (data === "[DONE]") {
                                            onEnd();
                                            return;
                                        }
                                        try {
                                            const json: StreamResponse = JSON.parse(data);
                                            if (logStyle === 'simple') {
                                                display.updateAgent({
                                                    ...agent,
                                                    ...json.usage
                                                })
                                            }
                                            json.choices.map(choice => {
                                                const delta = choice.delta
                                                if (delta) {
                                                    if (delta.reasoning_content) {
                                                        reasoning_content = Buffer.concat([reasoning_content, Buffer.from(delta.reasoning_content)])
                                                        if (logStyle === 'stream') {
                                                            process.stdout.write(delta.reasoning_content)
                                                        }
                                                    }
                                                    if (delta.content) {
                                                        content = Buffer.concat([content, Buffer.from(delta.content)])
                                                        if (logStyle === 'stream') {
                                                            process.stdout.write(delta.content)
                                                        }
                                                    }
                                                    if (delta.tool_calls) {
                                                        delta.tool_calls.map(tool => {
                                                            if (tool.id) {
                                                                const func = toolCallsMap.get(tool.id) || {}
                                                                const id = tool.id
                                                                const name = tool.function?.name
                                                                const args = tool.function?.arguments
                                                                if (name) func.name = name;
                                                                if (args) func.arguments = args;
                                                                if (id) func.id = id;
                                                                if (func.id) toolCallsMap.set(func.id, func)
                                                            }
                                                        })
                                                    }
                                                }
                                            })
                                        } catch (e) {
                                            throw e;
                                        }
                                    }
                                }
                            } catch (e) {
                                subscriber.error(e);
                            }
                        };
                        // 绑定事件处理器
                        stream.on("data", dataHandler);
                        stream.on("end", onEnd);
                        stream.on("error", (e: Error) => subscriber.error(e));
                    })
                    .catch((err: AxiosError) => {
                        subscriber.error(new Error(`status is: ${err.status}, error msg is : ${err.message} data is : ${JSON.stringify(data)}`))
                    });

                // 清理函数
                return () => controller.abort();
            });
        })
    )

}

export function requestWithRule<T>(params: ChatCompletionParams, zod: ZodType<T>) {
    const rule = z.union([zod, z.array(zod)])
    return createStreamCompletion<ChatCompletionParams>({
        ...params,
        messages: [
            ...params.messages,
            { role: 'user', content: `请严格按照以下JSON Schema的格式和约束生成数据，并输出一个完全符合该Schema的JSON对象。要求如下：1. **Schema定义**：\n ${JSON.stringify(zodToJsonSchema(zod))}\n 生成要求： * 必须完全遵守Schema中的字段类型、格式和约束条件（如minimum、format等） \n * 仅包含Schema中定义的字段，禁止添加额外字段（因additionalProperties: false）\n * 为缺失的字段填充合理的默认值（如is_active默认为true）\n 生成的数据需真实、合理（例如email需符合邮箱格式）。 \n并将结果放到content` },
        ],
        response_format: { type: 'json_object' }
    }).pipe(
        map(val => {
            try {
                try {
                    return rule.parse(val)
                } catch (e) {
                    if (val && (val as any).content) {
                        return rule.parse((val as any).content)
                    }
                    throw e;
                }
            } catch (e) {
                throw e;
            }
        }),
        map(val => {
            if (Array.isArray(val) && val.length === 1) {
                return val[0] as T;
            }
            return val as T;
        })
    )
}


export function createPrompts(params: ChatCompletionParams) {
    const histories: ChatMessage[] = [];
    histories.push({ role: 'system', content: `你是一个提示词生成助手` },)
    histories.push({ role: 'system', content: `根据用户的输入，生成结果\n<format>${JSON.stringify(CompletionSchema)}<format/>\n请按照<format>的格式输出，并将输出结果放到content` })
    histories.push(...params.messages.map(it => {
        it.content = `<content>${it.content}</content>\n生成符合<content>的提示词`
        return it;
    }))
    const currentParams: ChatCompletionParams = {
        ...params,
        messages: [
            ...histories,
        ]
    }
    return createStreamCompletion<ChatCompletionParams>(currentParams).pipe(
        map(val => {
            // TODO 
            if (Array.isArray(val) && val.length > 0) {
                val = val[0]
            }
            return Completion.parse(val)
        })
    )
}

// 生成agent
export function request<T>(params: ChatCompletionParams, zod: ZodType<T>): Observable<T | undefined> {
    return createPrompts(params).pipe(
        switchMap(val => {
            return requestWithRule<T>({
                ...val,
                messages: [
                    ...val.messages,
                    ...params.messages
                ],
                response_format: params.response_format || { type: 'json_object' }
            }, zod)
        })
    )
}

