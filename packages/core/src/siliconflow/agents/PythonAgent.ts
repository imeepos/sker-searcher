import { Observable } from "rxjs";
import { Agent } from "../../Agent";
import { SiliconflowChatCompletions, SiliconflowChatCompletionsResponse } from "../chat/completions";


export class PythonAgent extends Agent {
    run(question: string): Observable<SiliconflowChatCompletionsResponse> {
        return new SiliconflowChatCompletions({
            model: 'Pro/deepseek-ai/DeepSeek-R1',
            messages: [{
                role: 'system',
                content: `你叫Pythoner, 一个资深Python开发者, 精通python/数据分析算法/人工智能算法/音视频处理的开发工程师`
            }],
            temperature: 0,
        }).run({
            messages: [
                { role: 'user', content: question }
            ]
        })
    }
}