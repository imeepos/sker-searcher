
import { map, Observable, retry, switchMap } from "rxjs";
import axios, { AxiosError } from "axios";
import { string, z, ZodType } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { MultiTerminalDisplay, AgentStatus } from '@sker/terminal'
import { randomUUID } from "crypto";
export * from 'rxjs'
export type MODELS =
    | `Qwen/QwQ-32B`
    | `Pro/deepseek-ai/DeepSeek-R1`
    | `Pro/deepseek-ai/DeepSeek-V3`;
// 类型定义
interface ChatMessage {
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

export interface Message {
    role: "system" | "user" | "assistant";
    content: string;
    reasoning_content?: string;
    name?: string;
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

// 核心流式处理函数
export function createStreamCompletion<T>(
    params: ChatCompletionParams
): Observable<T> {
    // 创建专用 axios 实例
    const streamClient = axios.create({
        baseURL: "https://api.siliconflow.cn/v1",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.SILICONFLOW_API_KEY}`,
        },
        responseType: "stream", // 关键配置
    });
    return new Observable((subscriber) => {
        const controller = new AbortController();
        let reasoning_content = Buffer.from(``)
        let content = Buffer.from(``)
        params.name = params.name || randomUUID()
        const onEnd = () => {
            try {
                const response_format = params.response_format
                if (response_format) {
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
        streamClient
            .request({
                url: `/chat/completions`,
                method: 'post',
                data: {
                    ...params,
                    stream: true,
                },
                signal: controller.signal
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
                                const json: StreamResponse = JSON.parse(data);
                                display.updateAgent({
                                    ...agent,
                                    ...json.usage
                                })
                                json.choices.map(choice => {
                                    const delta = choice.delta
                                    if (delta) {
                                        if (delta.reasoning_content) {
                                            reasoning_content = Buffer.concat([reasoning_content, Buffer.from(delta.reasoning_content)])
                                        }
                                        if (delta.content) {
                                            content = Buffer.concat([content, Buffer.from(delta.content)])
                                        }
                                    }
                                })
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
                subscriber.error(err.response?.data || err.message);
            });

        // 清理函数
        return () => controller.abort();
    });
}

export function requestWithRule<T>(params: ChatCompletionParams, zod: ZodType<T>) {
    return createStreamCompletion<ChatCompletionParams>({
        ...params, messages: [
            { role: 'system', content: `根据用户的输入，生成结果\n<format>${JSON.stringify(zodToJsonSchema(zod))}<format/>\n请按照<format>的格式输出，并将输出结果放到content` },
            ...params.messages
        ]
    }).pipe(
        map(val => {
            try {
                return zod.parse(val)
            } catch (e) {
                console.error({ error: e, params: params, result: val })
            }
        }),
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
                response_format: { type: 'json_object' }
            }, zod).pipe(
                retry(3)
            )
        })
    )
}

