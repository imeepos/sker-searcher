export type TaskStatus =
    | 'waiting'
    | 'processing'
    | 'success'
    | 'failed'
    | 'error'
    | 'cancelled'
    | 'timeout';

export interface Task {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    status: TaskStatus;
    progress: number;
    request: any;
    headers?: any;
    query?: any;
    params?: any;
    response?: any;
    error?: string;
    estimatedDuration?: number; // 预计总时长(ms)
    timeout?: number; // 超时时间(ms)
    webhookUrl?: string;
}

export interface TaskUpdate {
    status?: TaskStatus;
    progress?: number;
    response?: any;
    error?: string;
}