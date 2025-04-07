import amqp, { Channel, ChannelModel } from 'amqplib';
import { Task, TaskUpdate } from './types.js';

export class RabbitMQ {
    private connection: ChannelModel | null = null;
    private channel: Channel | null = null;

    constructor(private uri: string) { }

    async connect() {
        this.connection = await amqp.connect(this.uri);
        this.channel = await this.connection.createChannel();

        // 声明任务队列
        await this.channel.assertQueue('tasks', { durable: true });
        // 声明状态更新队列
        await this.channel.assertQueue('status_updates', { durable: true });

        return this;
    }

    async publishTask(task: Task) {
        if (!this.channel) throw new Error('Channel not initialized');
        await this.channel.sendToQueue(
            'tasks',
            Buffer.from(JSON.stringify(task)),
            { persistent: true }
        );
    }

    async consumeTasks(callback: (task: Task) => Promise<void>) {
        if (!this.channel) throw new Error('Channel not initialized');
        await this.channel.consume('tasks', async (msg) => {
            if (msg) {
                const task = JSON.parse(msg.content.toString()) as Task;
                try {
                    await callback(task);
                    this.channel!.ack(msg);
                } catch (err) {
                    this.channel!.nack(msg);
                }
            }
        });
    }

    async publishStatusUpdate(taskId: string, update: TaskUpdate) {
        if (!this.channel) throw new Error('Channel not initialized');
        await this.channel.sendToQueue(
            'status_updates',
            Buffer.from(JSON.stringify({ taskId, update })),
            { persistent: true }
        );
    }

    async consumeStatusUpdates(callback: (taskId: string, update: TaskUpdate) => Promise<void>) {
        if (!this.channel) throw new Error('Channel not initialized');
        await this.channel.consume('status_updates', async (msg) => {
            if (msg) {
                const { taskId, update } = JSON.parse(msg.content.toString());
                await callback(taskId, update);
                this.channel!.ack(msg);
            }
        });
    }

    async close() {
        if (this.channel) await this.channel.close();
        if (this.connection) await this.connection.close();
    }
}
