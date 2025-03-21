
export type TaskResult<T = any> = {
    agent: string;
    success: boolean;
    data: T | Error;
};

export function isTaskResult<T>(val: any): val is TaskResult<T> {
    return Reflect.has(val, 'agent') && Reflect.has(val, 'success') && Reflect.has(val, 'data')
}