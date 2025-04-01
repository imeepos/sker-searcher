export * from './types'
export * from './Agent'
export * from './Coordinator'
export * from './skerAxios'
export * from './siliconflow'
export * from 'rxjs'
export * from 'axios'

import { Observable } from "rxjs";
import axios, { AxiosError } from "axios";
export type MODELS =
    | `Qwen/QwQ-32B`
    | `Pro/deepseek-ai/DeepSeek-R1`
    | `Pro/deepseek-ai/DeepSeek-V3`
    | `deepseek-ai/DeepSeek-R1`
    | `deepseek-ai/DeepSeek-V3`
    | `deepseek-ai/DeepSeek-R1-Distill-Qwen-32B`
    | `deepseek-ai/DeepSeek-R1-Distill-Qwen-14B`
    | `deepseek-ai/DeepSeek-R1-Distill-Qwen-7B`
    | `deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B`
    | `Pro/deepseek-ai/DeepSeek-R1-Distill-Qwen-7B`
    | `Pro/deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B`
    | `deepseek-ai/DeepSeek-V2.5`
    | `Qwen/Qwen2.5-72B-Instruct-128K`
    | `Qwen/Qwen2.5-72B-Instruct`
    | `Qwen/Qwen2.5-32B-Instruct`
    | `Qwen/Qwen2.5-14B-Instruct`
    | `Qwen/Qwen2.5-7B-Instruct`
    | `Qwen/Qwen2.5-Coder-32B-Instruct`
    | `Qwen/Qwen2.5-Coder-7B-Instruct`
    | `Qwen/Qwen2-7B-Instruct`
    | `Qwen/Qwen2-1.5B-Instruct`
    | `Qwen/QwQ-32B-Preview`
    | `TeleAI/TeleChat2`
    | `THUDM/glm-4-9b-chat`
    | `Vendor-A/Qwen/Qwen2.5-72B-Instruct`
    | `internlm/internlm2_5-7b-chat`
    | `internlm/internlm2_5-20b-chat`
    | `Pro/Qwen/Qwen2.5-7B-Instruct`
    | `Pro/Qwen/Qwen2-7B-Instruct`
    | `Pro/Qwen/Qwen2-1.5B-Instruct`
    | `Pro/THUDM/chatglm3-6b`
    | `Pro/THUDM/glm-4-9b-chat`;
// 类型定义
interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

interface ChatCompletionParams {
    messages: ChatMessage[];
    model?: MODELS;
    temperature?: number;
    stream?: boolean;
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
    choices: Array<CompletionChoice>;
}

// 核心流式处理函数
export function createStreamCompletion(
    params: ChatCompletionParams
): Observable<Message> {

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

        streamClient
            .request({
                url: `/chat/completions`,
                method: 'post',
                data: {
                    ...params,
                    stream: true, // 强制开启流式
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
                                    
                                    subscriber.complete();
                                    return;
                                }
                                const json: StreamResponse = JSON.parse(data);
                                json.choices.map(choice => {
                                    const delta = choice.delta
                                    if (delta) {
                                        if (delta.reasoning_content) {
                                            process.stdout.write(delta.reasoning_content)
                                        }
                                        if (delta.content) {
                                            process.stdout.write(delta.content)
                                        }
                                    }
                                    subscriber.next(choice.delta)
                                })
                            }
                        }
                    } catch (e) {
                        subscriber.error(e);
                    }
                };
                // 绑定事件处理器
                stream.on("data", dataHandler);
                stream.on("end", () => subscriber.complete());
                stream.on("error", (e: Error) => subscriber.error(e));
            })
            .catch((err: AxiosError) => {
                subscriber.error(err.response?.data || err.message);
            });

        // 清理函数
        return () => controller.abort();
    });
}