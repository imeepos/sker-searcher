```ts
import { Observable } from "rxjs";
// 根据用户需求 选择合适的模型
export type MODELS = `Qwen/QwQ-32B` | `Pro/deepseek-ai/DeepSeek-R1` | `Pro/deepseek-ai/DeepSeek-V3` | `deepseek-ai/DeepSeek-R1` | `deepseek-ai/DeepSeek-V3` | `deepseek-ai/DeepSeek-R1-Distill-Qwen-32B` | `deepseek-ai/DeepSeek-R1-Distill-Qwen-14B` | `deepseek-ai/DeepSeek-R1-Distill-Qwen-7B` | `deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B` | `Pro/deepseek-ai/DeepSeek-R1-Distill-Qwen-7B` | `Pro/deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B` | `deepseek-ai/DeepSeek-V2.5` | `Qwen/Qwen2.5-72B-Instruct-128K` | `Qwen/Qwen2.5-72B-Instruct` | `Qwen/Qwen2.5-32B-Instruct` | `Qwen/Qwen2.5-14B-Instruct` | `Qwen/Qwen2.5-7B-Instruct` | `Qwen/Qwen2.5-Coder-32B-Instruct` | `Qwen/Qwen2.5-Coder-7B-Instruct` | `Qwen/Qwen2-7B-Instruct` | `Qwen/Qwen2-1.5B-Instruct` | `Qwen/QwQ-32B-Preview` | `TeleAI/TeleChat2` | `THUDM/glm-4-9b-chat` | `Vendor-A/Qwen/Qwen2.5-72B-Instruct` | `internlm/internlm2_5-7b-chat` | `internlm/internlm2_5-20b-chat` | `Pro/Qwen/Qwen2.5-7B-Instruct` | `Pro/Qwen/Qwen2-7B-Instruct` | `Pro/Qwen/Qwen2-1.5B-Instruct` | `Pro/THUDM/chatglm3-6b` | `Pro/THUDM/glm-4-9b-chat`;

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
export declare function createStreamCompletion(params: ChatCompletionParams): Observable<Message>;
```

将用户的问题，通过**createStreamCompletion**函数调用，来生成答案