import express from 'express';
import { TaskStore } from './taskStore.js';
import { RabbitMQ } from './rabbitmq.js';

export class Gateway {
    private app: express.Application;
    private taskStore: TaskStore;
    private rabbitMQ: RabbitMQ;

    constructor() {
        this.app = express();
        this.app.use(express.json());

        this.taskStore = new TaskStore(process.env.REDIS_URL || 'redis://localhost:6379');
        this.rabbitMQ = new RabbitMQ(process.env.RABBITMQ_URL || 'amqp://localhost');

        this.setupRoutes();
    }

    private async setupRabbitMQ() {
        await this.rabbitMQ.connect();
        // 消费状态更新消息
        await this.rabbitMQ.consumeStatusUpdates(async (taskId, update) => {
            await this.taskStore.updateTask(taskId, update);
        });
    }

    private setupRoutes() {
        // 提交新任务
        this.app.post('/tasks', async (req, res) => {
            try {
                const task = await this.taskStore.createTask({
                    status: 'waiting',
                    progress: 0,
                    request: req.body,
                    estimatedDuration: req.body.estimatedDuration,
                    timeout: req.body.timeout || 60000, // 默认60秒超时
                    webhookUrl: req.body.webhookUrl,
                    headers: req.headers,
                    query: req.query,
                    params: req.params,
                });

                // 发布任务到队列
                await this.rabbitMQ.publishTask(task);

                res.status(202).json({
                    taskId: task.id,
                    status: task.status,
                    progress: task.progress,
                    createdAt: task.createdAt,
                });
            } catch (err) {
                res.status(500).json({ error: 'Failed to create task' });
            }
        });

        // 获取任务状态
        this.app.get('/tasks/:id', async (req, res) => {
            try {
                const task = await this.taskStore.getTask(req.params.id);
                if (!task) {
                    res.status(404).json({ error: 'Task not found' });
                    return;
                }
                res.json({
                    id: task.id,
                    status: task.status,
                    progress: task.progress,
                    response: task.response,
                    error: task.error,
                    createdAt: task.createdAt,
                    updatedAt: task.updatedAt,
                });
                return;
            } catch (err) {
                res.status(500).json({ error: 'Failed to get task status' });
                return;
            }
        });

        // 取消任务
        this.app.post('/tasks/:id/cancel', async (req, res) => {
            try {
                const success = await this.taskStore.cancelTask(req.params.id);
                if (!success) {
                    res.status(400).json({ error: 'Task cannot be cancelled' });
                    return;
                }

                res.json({ success: true });
            } catch (err) {
                res.status(500).json({ error: 'Failed to cancel task' });
            }
        });

        // WebSocket 长连接支持
        this.app.get('/tasks/:id/stream', (req, res) => {
            // 实现WebSocket或SSE长连接
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const taskId = req.params.id;
            const sendUpdate = async () => {
                const task = await this.taskStore.getTask(taskId);
                if (task) {
                    res.write(`data: ${JSON.stringify({
                        status: task.status,
                        progress: task.progress,
                        response: task.response,
                        error: task.error,
                    })}\n\n`);

                    if (['success', 'failed', 'error', 'cancelled', 'timeout'].includes(task.status)) {
                        clearInterval(interval);
                        res.end();
                    }
                }
            };

            const interval = setInterval(sendUpdate, 1000);

            req.on('close', () => {
                clearInterval(interval);
                res.end();
            });
        });
    }

    async start(port: number) {
        await this.setupRabbitMQ();
        this.app.listen(port, () => {
            console.log(`Gateway server running on port ${port}`);
        });
    }
}
