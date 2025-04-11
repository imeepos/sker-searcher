import { ChatMessage, MODELS } from "@sker/axios";

export enum AgentState {
    IDLE = "IDLE",
    RUNNING = "RUNNING",
    FINISHED = "FINISHED",
    ERROR = "ERROR"
}

export class BaseAgent {
    name: string;
    description: string;
    systemPrompt: string;
    nextStepPrompt: string;

    model: MODELS = 'Pro/deepseek-ai/DeepSeek-R1';
    state: AgentState = AgentState.IDLE;
    maxStep: number = 10;
    currentStep: number = 0;
    messages: ChatMessage[] = [];
}