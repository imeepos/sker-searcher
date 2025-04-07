import logUpdate from './logUpdate.js';
import chalk from 'chalk';

/**
 * 智能体状态接口
 */
export interface AgentStatus {
    /** 智能体名称 */
    name: string;
    /** 已用 token 数量 */
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    /** 最后更新时间 */
    createDate: Date;
}

/**
 * 命令行区域布局配置
 */
export interface TerminalLayout {
    /** 区域宽度 */
    width: number;
    /** 区域高度 */
    height: number;
    /** 区域之间的边距 */
    margin: number;
}

/**
 * 多区域终端显示器类
 */
export class MultiTerminalDisplay {
    private agents: Map<string, AgentStatus>;
    private layout: TerminalLayout;
    private timer?: NodeJS.Timeout;

    /**
     * 构造函数
     * @param layout 布局配置
     */
    constructor(layout: TerminalLayout = { width: 30, height: 5, margin: 2 }) {
        this.agents = new Map();
        this.layout = layout;
    }

    /**
     * 添加或更新智能体状态
     * @param agent 智能体状态
     */
    updateAgent(agent: AgentStatus): void {
        this.agents.set(agent.name, {
            ...agent,
        });
        this.render();
    }

    /**
     * 移除智能体
     * @param name 智能体名称
     */
    removeAgent(name: string): void {
        this.agents.delete(name);
        this.render();
    }

    /**
     * 开始自动渲染
     * @param interval 渲染间隔(毫秒)
     */
    startAutoRender(interval: number = 1000): void {
        this.stopAutoRender();
        this.timer = setInterval(() => this.render(), interval);
    }

    /**
     * 停止自动渲染
     */
    stopAutoRender(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }

    /**
     * 渲染所有区域到终端
     */
    private render(): void {
        const agentList = Array.from(this.agents.values());
        const output = this.generateLayout(agentList);
        logUpdate(output);
    }

    /**
     * 生成布局字符串
     * @param agents 智能体列表
     * @returns 格式化后的布局字符串
     */
    private generateLayout(agents: AgentStatus[]): string {
        const { width, margin } = this.layout;
        const terminalWidth = process.stdout.columns || 80;
        const effectiveWidth = width + margin;
        const agentsPerLine = Math.max(1, Math.floor(terminalWidth / effectiveWidth));

        const lines: string[] = [];
        for (let i = 0; i < agents.length; i += agentsPerLine) {
            const lineAgents = agents.slice(i, i + agentsPerLine);
            const agentBlocks = lineAgents.map(agent => this.formatAgentBlock(agent));

            const blockLines = agentBlocks[0]?.split('\n') || [];
            for (let lineNum = 0; lineNum < blockLines.length; lineNum++) {
                const lineParts = agentBlocks.map(block => {
                    const lines = block.split('\n');
                    return lines[lineNum] || '';
                });
                lines.push(lineParts.join(' '.repeat(margin)));
            }
        }

        return lines.join('\n');
    }

    /**
    * 格式化单个智能体区域
    * @param agent 智能体状态
    * @returns 格式化后的区域字符串
    */
    private formatAgentBlock(agent: AgentStatus): string {
        const { width, height } = this.layout;
        const now = new Date();
        const secondsAgo = Math.floor((now.getTime() - agent.createDate.getTime()) / 1000);
        const timeText = `${secondsAgo}s`;

        // 精确计算各部分宽度
        const innerWidth = width - 2; // 减去边框
        const timeWidth = timeText.length + 1; // 时间文本宽度加一个空格
        const titleMaxWidth = innerWidth - timeWidth - 2;

        // 处理标题文本
        const title = agent.name.length > titleMaxWidth
            ? agent.name.substring(0, titleMaxWidth - 1) + '…'
            : agent.name.padEnd(titleMaxWidth);

        // 构建标题行，确保对齐
        const titleLine = `│ ${chalk.bold(title.padEnd(titleMaxWidth))} ${chalk.dim(timeText.padStart(3))} │`;

        // 构建token行
        const totalTokensLine = `│ Total Tokens: ${chalk.green(agent.total_tokens.toLocaleString())}${' '.repeat(innerWidth - 14 - agent.total_tokens.toLocaleString().length - 1)}│`;

        const promptTokensLine = `│ Prompt Tokens: ${chalk.green(agent.prompt_tokens.toLocaleString())}${' '.repeat(innerWidth - 15 - agent.prompt_tokens.toLocaleString().length - 1)}│`;

        const completionTokensLine = `│ Completion Tokens: ${chalk.green(agent.completion_tokens.toLocaleString())}${' '.repeat(innerWidth - 19 - agent.completion_tokens.toLocaleString().length - 1)}│`;

        // 构建边框
        const border = chalk.gray('─'.repeat(innerWidth));
        const topBorder = chalk.gray('┌' + border + '┐');
        const bottomBorder = chalk.gray('└' + border + '┘');

        // 填充剩余高度
        const contentHeight = height - 2; // 减去上下边框
        const contentLines = [
            titleLine,
            totalTokensLine,
            promptTokensLine,
            completionTokensLine
        ];

        const remainingLines = Math.max(0, contentHeight - contentLines.length);
        const emptyLines = Array(remainingLines).fill(`│${' '.repeat(innerWidth)}│`);

        return [
            topBorder,
            ...contentLines,
            ...emptyLines,
            bottomBorder
        ].join('\n');
    }

    /**
     * 清空终端输出
     */
    clear(): void {
        logUpdate.clear();
    }
}
