import { Observable } from "rxjs";
import { Agent } from "../../Agent";
import { SiliconflowChatCompletions, SiliconflowChatCompletionsResponse } from "../chat/completions";


export class DbaAgent extends Agent {
    run(question: string): Observable<SiliconflowChatCompletionsResponse> {
        return new SiliconflowChatCompletions({
            model: 'Pro/deepseek-ai/DeepSeek-R1',
            messages: [{
                role: 'system',
                content: `你叫dbaer, 一个资深DBA, 精通Mysql/Postgres/分布式数据库/数据库表设计/运维等`
            }],
            temperature: 0,
        }).run({
            messages: [
                { role: 'user', content: question }
            ]
        })
    }
}