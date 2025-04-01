```ts
import { Observable } from "rxjs";
import axios, { AxiosError } from "axios";
import { MODELS } from './types'

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
                                json.choices.map(choice => subscriber.next(choice.delta))
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
```


上述代码已实现基础功能，还需要扩展以下功能

1. 可以连续对话 并保留对话上下文
