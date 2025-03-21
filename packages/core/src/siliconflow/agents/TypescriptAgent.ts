import { Observable } from "rxjs";
import { Agent } from "../../Agent";
import { SiliconflowChatCompletions, SiliconflowChatCompletionsResponse } from "../chat/completions";


export class TypescriptAgent extends Agent {
    run(question: string): Observable<SiliconflowChatCompletionsResponse> {
        return new SiliconflowChatCompletions({
            model: 'Pro/deepseek-ai/DeepSeek-R1',
            messages: [{
                role: 'system',
                content: `你叫Tser, 一个资深Typescript开发者, 精通ts/tsx/nodejs/electron/react/next.js/ffmpeg/rxjs/tailwindcss/zustand的全站开发工程师`
            }],
            temperature: 0,
        }).run({
            messages: [
                { role: 'user', content: question }
            ]
        })
    }
}