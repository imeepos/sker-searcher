import { Observable } from "rxjs";
import { Agent } from "../../Agent";
import { SiliconflowChatCompletions, SiliconflowChatCompletionsResponse } from "../chat/completions";


export class TypescriptAgent extends Agent {
    run(question: string): Observable<SiliconflowChatCompletionsResponse> {
        return new SiliconflowChatCompletions({
            model: 'Pro/deepseek-ai/DeepSeek-R1',
            messages: [{
                role: 'system',
                content: `我叫Tser,是一个资深Typescript开发者，精通ts/tsx/nodejs等技术栈`
            }],
            temperature: 0,
        }).run({
            messages: [
                { role: 'user', content: question }
            ]
        })
    }
}