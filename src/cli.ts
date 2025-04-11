import "reflect-metadata"
import { config } from 'dotenv'
import { join } from "path";
import axios, { AxiosError } from "axios";

async function bootstrap() {
    const root = process.cwd()
    config({
        path: join(root, '.env')
    })
    await axios.request({
        method: 'post',
        url: `http://localhost:8089/tasks/6e3afb5b-7297-473a-b822-150995ce8b94/cancel`,
        data: {}
    })
    const res = await axios.request({
        method: 'post',
        url: `http://localhost:8089/tasks`,
        data: {
            prompts: `【需求】
我要做一个基于Electron的视频剪辑软件，请帮我设计一下整体架构，不需要编码实现及测试运维实施。
1. 实现资源库功能
    - 文件类型
        * 本地文件
        * 云端文件
    - 文件分类
        * 视频文件
        * 音频文件
        * 字体文件
        * 特效文件
2. 直播打点
    - 从一个完整的视频 切割出 某商品的视频 然后进入素材库
3. 【商品】视频合并
    - 从素材库中选择素材/特效/字体/背景音乐等 生成新的视频
4. 视频发布
    - 多平台支持：抖音/快手/小红书/TK等
5. 权限及收费功能
6. 营销推广功能

【基础设施】
* cloudflare Workers & Pages
* cloudflare Workflows
* Cloudflare Stroage & Databases
    - KV
    - D1 SQL Database
    - Hyperdirve
    - Queues
* Cloudflare R2 Object Storage 
* AWS s3 网络存储
* modal 密集型计算资源，包含CPU/GPU，如视频剪辑/拼接/特效/切割等
* 错误日志收集: Sentry
* 前端: React/Typescript
* 状态管理: zustand
* 样式库：twilwind
* 火山云
    - 视频播放器
    - 直播录制
    - 直播资源存储
` 
        }
    }).then(res => res.data)
    // const res = await axios.request({
    //     method: 'get',
    //     url: `http://localhost:8089/tasks/ce729483-faa8-41e8-a640-efae98f90f67`
    // }).then(res => res.data)
    console.log(res)
}

bootstrap()