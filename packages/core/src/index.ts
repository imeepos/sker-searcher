export * from './types'
export * from './Agent'
export * from './Coordinator'
export * from './skerAxios'
export * from './siliconflow'
export * from 'rxjs'
export * from 'axios'

import { Observable } from "rxjs";
import axios, { AxiosError } from "axios";

// 类型定义
interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

interface ChatCompletionParams {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
    stream?: boolean;
}

interface StreamResponse {
    id: string;
    created: number;
    choices: Array<{
        delta: {
            content?: string,
            role?: string,
        },
        index: number,
        finish_reason: string | null,
    }>;
}

// 创建专用 axios 实例
const streamClient = axios.create({
    baseURL: "https://api.siliconflow.cn/v1",
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SILICONFLOW_API_KEY}`,
    },
    responseType: "stream", // 关键配置
});

// 核心流式处理函数
function createStreamCompletion(
    params: ChatCompletionParams
): Observable<string> {
    return new Observable((subscriber) => {
        const controller = new AbortController();

        streamClient
            .post(
                "/chat/completions",
                {
                    ...params,
                    stream: true, // 强制开启流式
                },
                {
                    signal: controller.signal,
                }
            )
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
                                const content = json.choices[0].delta.content;
                                if (content) {
                                    subscriber.next(content);
                                }
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