import "reflect-metadata"
import { config } from 'dotenv'
import { join } from "path";
import axios, { AxiosError } from "axios";

async function bootstrap() {
    const root = process.cwd()
    config({
        path: join(root, '.env')
    })
    const res = await axios.request({
        method: 'post',
        url: `http://localhost:8089/tasks`,
        data: {
            prompts: `【需求】设计一个桌面端软件UI/UX规范 【要求】1. 暗黑主题 2. 简洁科技风`
        }
    }).then(res => res.data)
    // const res = await axios.request({
    //     method: 'get',
    //     url: `http://localhost:8089/tasks/ce729483-faa8-41e8-a640-efae98f90f67`
    // }).then(res => res.data)
    console.log(res)
}

bootstrap()