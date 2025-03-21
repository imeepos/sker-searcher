import { Observable } from "rxjs";
import { Agent } from "../../Agent";
import { SiliconflowChatCompletions, SiliconflowChatCompletionsResponse } from "../chat/completions";


export class PmAgent extends Agent {
    run(question: string): Observable<SiliconflowChatCompletionsResponse> {
        return new SiliconflowChatCompletions({
            model: 'Pro/deepseek-ai/DeepSeek-R1',
            messages: [{
                role: 'system',
                content: `你叫pmer, 一个资深产品经理, 精通项目管理/风险控制/客户沟通等`
            }],
            temperature: 0,
        }).run({
            messages: [
                { role: 'user', content: question }
            ]
        })
    }
}