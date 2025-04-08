import { RabbitMQ } from './rabbitmq.js';
import { TaskStore } from './taskStore.js';
import { Task } from './types.js';

export abstract class Worker {
    private taskStore: TaskStore;
    private rabbitMQ: RabbitMQ;

    name: string;
    desc: string;

    constructor() {
        this.taskStore = new TaskStore(process.env.REDIS_URL || 'redis://localhost:6379');
        this.rabbitMQ = new RabbitMQ(process.env.RABBITMQ_URL || 'amqp://localhost');
    }

    async start() {
        await this.rabbitMQ.connect();
        // 消费任务队列
        await this.rabbitMQ.consumeTasks(async (task) => {
            try {
                // 检查任务是否已被取消
                const currentTask = await this.taskStore.getTask(task.id);
                if (!currentTask || currentTask.status === 'cancelled') {
                    return;
                }
                // 更新状态为处理中
                await this.rabbitMQ.publishStatusUpdate(task.id, {
                    status: 'processing',
                    progress: 0,
                });
                // 处理任务
                await this.processTask(task);
            } catch (err) {
                console.error(`Error processing task ${task.id}:`, err);
                await this.rabbitMQ.publishStatusUpdate(task.id, {
                    status: 'error',
                    error: err instanceof Error ? err.message : 'Unknown error',
                });
            }
        });
        console.log('Worker started and waiting for tasks...');
    }

    abstract __processTask<T = any>(task: Task): Promise<T>;

    private async processTask(task: Task): Promise<void> {
        // 获取最新状态
        const currentTask = await this.taskStore.getTask(task.id);
        if (!currentTask) return;
        // 如果是已取消 直接返回
        if (currentTask.status === 'cancelled') {
            return;
        }
        const res = await this.__processTask(currentTask);
        await this.finishTask(task.id, res);
    }
    // 更新进度
    public async udpateTaskProgress(id: string, progress: number) {
        await this.rabbitMQ.publishStatusUpdate(id, {
            progress,
        });
    }

    public async finishTask(id: string, res: any) {
        await this.rabbitMQ.publishStatusUpdate(id, {
            status: 'success',
            progress: 100,
            response: res,
        });
    }

    public publishStatusUpdate(task: Partial<Task>) {
        const { id, status, progress, response } = task;
        if (id) {
            return this.rabbitMQ.publishStatusUpdate(id, {
                status: status,
                progress: progress,
                response: response
            })
        }
    }
}
