import { createStreamCompletion } from "@sker/axios";
import { injectable } from "@sker/core";
import { Task, Worker } from "@sker/mq";

@injectable()
export class ViewWeaverWorker extends Worker {
    private ui = { "id": "b19eedd7-8166-4ecb-9bbf-02ea57c3cf43", "status": "success", "progress": 100, "response": "以下是为软件设计的UI/UX规范，基于暗黑主题和简洁科技风格的要求：\n\n---\n\n## **软件UI/UX设计规范**\n**版本号：1.0.0**  \n**主题：暗黑模式（Dark Theme）**  \n**风格：简洁科技风**\n\n---\n\n### **1. 色彩体系**\n#### **主色**\n- **品牌色**：`#3A86FF`（科技蓝，用于主要操作按钮和高亮元素）\n- **辅助色**：\n  - `#8338EC`（紫色，用于次要操作或状态提示）\n  - `#FF006E`（粉色，用于警告或错误状态）\n\n#### **中性色（暗黑主题）**\n- **背景色**：\n  - 主背景：`#121212`\n  - 次级背景：`#1E1E1E`\n  - 卡片背景：`#2A2A2A`\n- **文字色**：\n  - 主文字：`#FFFFFF`（纯白）\n  - 次级文字：`#B0B0B0`（浅灰）\n  - 禁用文字：`#666666`（深灰）\n- **边框色**：\n  - 默认边框：`#3D3D3D`\n  - 高亮边框：`#3A86FF`\n\n#### **状态色**\n- 成功：`#4CAF50`\n- 警告：`#FFC107`\n- 错误：`#FF5252`\n- 信息：`#2196F3`\n\n---\n\n### **2. 排版系统**\n#### **字体**\n- **主字体**：`Inter`（现代无衬线字体）\n- **代码字体**：`Fira Code`（用于代码块或技术内容）\n\n#### **字号**\n- 标题：`24px` / `1.5rem`\n- 副标题：`18px` / `1.125rem`\n- 正文：`14px` / `0.875rem`\n- 辅助文字：`12px` / `0.75rem`\n\n#### **行高**\n- 标题：`1.3`\n- 正文：`1.5`\n- 代码块：`1.6`\n\n---\n\n### **3. 交互与动效**\n#### **按钮**\n- **主按钮**：\n  - 背景色：`#3A86FF`\n  - 悬停色：`#2A76EF`\n  - 按下色：`#1A66DF`\n  - 圆角：`4px`\n- **次按钮**：\n  - 背景色：透明\n  - 边框：`1px solid #3D3D3D`\n  - 悬停边框：`1px solid #3A86FF`\n\n#### **动效**\n- **悬停效果**：轻微放大（`scale: 1.05`）\n- **点击反馈**：轻微下沉（`translateY: 1px`）\n- **过渡时间**：`0.2s`\n\n---\n\n### **4. 组件设计**\n#### **输入框**\n- 背景色：`#1E1E1E`\n- 边框：`1px solid #3D3D3D`\n- 聚焦边框：`1px solid #3A86FF`\n- 占位文字：`#666666`\n\n#### **卡片**\n- 背景色：`#2A2A2A`\n- 阴影：`0 2px 8px rgba(0, 0, 0, 0.3)`\n- 圆角：`8px`\n\n#### **导航栏**\n- 背景色：`#121212`\n- 选中项：`#3A86FF`\n- 悬停项：`#1E1E1E`\n\n---\n\n### **5. 无障碍设计**\n- **对比度**：确保文字与背景的对比度至少为 `4.5:1`。\n- **键盘导航**：支持 `Tab` 键切换焦点。\n- **焦点状态**：高亮显示（`outline: 2px solid #3A86FF`）。\n\n---\n\n### **6. 示例代码**\n```css\n/* 按钮样式 */\n.button-primary {\n  background-color: #3A86FF;\n  color: white;\n  border: none;\n  padding: 8px 16px;\n  border-radius: 4px;\n  transition: all 0.2s;\n}\n\n.button-primary:hover {\n  background-color: #2A76EF;\n  transform: scale(1.05);\n}\n\n.button-primary:active {\n  background-color: #1A66DF;\n  transform: translateY(1px);\n}\n```\n\n---\n\n", "createdAt": "2025-04-08T01:23:36.316Z", "updatedAt": "2025-04-08T01:31:05.886Z" }
    private json = { "role": "资深前端开发工程师", name: "ViewWeaver", name_cn: "织影（Loom）", "author": "imeepos", "version": "1.0.0", "description": "全栈型前端开发专家，精通主流框架与工程化体系，具备从架构设计到性能优化的全链路开发能力", "language": "中文", "rules": ["技术栈react/typescript", "严格遵循ES6+语法规范", "组件设计符合原子化原则", "状态管理使用zustand", "路由管理采用最新React Router", "样式方案使用twilwind"], "workflow": ["需求分析 → 技术方案设计 → 组件/模块拆分 → 模块开发 → 单元测试 → 集成测试 → 代码审查"], "format": "React函数组件+TypeScript+Webpack5+Jest测试框架", "initialization": "您好，我是您的前端开发助手，可提供从项目搭建到生产部署的全流程技术支持。请说明当前需要处理的开发任务或遇到的难题。" }
    constructor() {
        super();
        this.name = this.json.name;
        this.desc = this.json.description;
    }
    async __processTask(task: Task): Promise<any> {
        const body = task.request
        const prompts = body.prompts
        return new Promise<any>((resolve, reject) => {
            createStreamCompletion({
                model: 'Pro/deepseek-ai/DeepSeek-V3',
                messages: [
                    { role: 'system', content: `作为角色 ${this.json.role}, 英文名 ${this.json.name}, 中文名 ${this.json.name_cn}, 负责 ${this.json.description}, 我将严格遵守 ${this.json.rules}, 按照 ${this.json.workflow}流程工作， 使用默认 ${this.json.language} 与用户对话，遵循${this.ui.response}设计规范，严格按照 ${this.json.format} 格式输出，目前的版本号是 ${this.json.version}, 友好的欢迎用户, ${this.json.initialization}` },
                    { role: 'user', content: prompts },
                ],
                response_format: { type: 'text' },
                temperature: 0.3,
                name: this.json.name_cn
            }).subscribe({
                next(value) {
                    resolve(value)
                },
                error(err) {
                    reject(err)
                },
                complete: () => {

                },
            })
        })
    }
}