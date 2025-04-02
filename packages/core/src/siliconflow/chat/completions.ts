import { Siliconflow } from "../siliconflow.js";
export interface Message {
    role: "system" | "user" | "assistant";
    content: string;
    reasoning_content?: string;
    name?: string;
}

type MODEL =
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
export interface SiliconflowChatCompletionsTool {
    type: 'function';
    function: {
        strict: boolean;
        name: string;
        description: string;
        parameters: any;
    }
}
export type SiliconflowChatCompletionsTools = SiliconflowChatCompletionsTool[]

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
export interface SiliconflowChatCompletionsRequest {
    model: MODEL;             // 必须的模型名称，如"kimi"
    messages: Message[];       // 必须的消息数组
    stream?: boolean;          // 是否流式输出
    temperature?: number;      // 温度参数 (0～1)
    top_p?: number;            // 核心采样概率 (0～1)
    max_tokens?: number;       // 最大返回token数
    stop?: string | string[];  // 停止序列
    frequency_penalty?: number;// 频率惩罚 (-2.0～2.0)
    n?: number;
    response_format?: ResponseFormatJsonObject | ResponseFormatText | ResponseFormatJsonSchema;
    tools?: SiliconflowChatCompletionsTools
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
