
export type TaskResult<T = any> = {
    agentId: string;
    success: boolean;
    data?: T;
    error?: Error;
};
