import { Siliconflow } from "../siliconflow";
export interface Message {
    role: "system" | "user" | "assistant";
    content: string;
    name?: string;
}
export interface SiliconflowChatCompletionsRequest {
    model: string;             // 必须的模型名称，如"kimi"
    messages: Message[];       // 必须的消息数组
    stream?: boolean;          // 是否流式输出
    temperature?: number;      // 温度参数 (0～1)
    top_p?: number;            // 核心采样概率 (0～1)
    max_tokens?: number;       // 最大返回token数
    stop?: string | string[];  // 停止序列
    presence_penalty?: number; // 存在惩罚 (-2.0～2.0)
    frequency_penalty?: number;// 频率惩罚 (-2.0～2.0)
}

interface CompletionChoice {
    index: number;
    message: Message;
    finish_reason: "stop" | "length" | "content_filter" | "tool_calls";
}

interface Usage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface SiliconflowChatCompletionsResponse {
    id: string;          // 请求ID
    object: "chat.completion";
    created: number;     // 时间戳
    model: string;       // 模型名称
    choices: CompletionChoice[];
    usage: Usage;
}

export class SiliconflowChatCompletions extends Siliconflow<SiliconflowChatCompletionsRequest, SiliconflowChatCompletionsResponse> {
    constructor(data: SiliconflowChatCompletionsRequest) {
        super({
            url: `/v1/chat/completions`,
            method: `POST`,
            headers: {
                Authorization: `Bearer sk-twzcwxdhjfhmyclgajricjcyjgcgiwgmpplasvhzejtytcdl`,
                "Content-Type": `application/json`
            },
            data: data
        })
    }
}