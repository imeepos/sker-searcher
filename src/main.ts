import { SiliconflowChatCompletions } from '@sker/core'
async function bootstrap() {
    console.log(`hello sker searcher`)
    const tser = new TypescriptAgent
    const chatCompletions = new SiliconflowChatCompletions({
        model: 'Pro/deepseek-ai/DeepSeek-R1',
        messages: [{
            role: 'user',
            content: `介绍下你自己`
        }]
    })
    chatCompletions.run().subscribe({
        next(value) {
            console.log(JSON.stringify(value, null, 2))
        },
    })
}
bootstrap()