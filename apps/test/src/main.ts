import { config } from 'dotenv'
import { OpenAI } from 'openai'

config()
const openAi = new OpenAI()
const completion = openAi.chat.completions.create({
    model: `THUDM/GLM-Z1-32B-0414`,
    messages: [
        { role: 'user', content: `你好` }
    ]
})

completion.then(res => {
    console.log(JSON.stringify(res, null, 2))
})
console.log(`@app/test`)