import { Redis } from 'ioredis';
import { Task, TaskUpdate } from './types.js';
import { randomUUID } from 'crypto';

export class TaskStore {
    private redis: Redis;

    constructor(redisUrl: string) {
        this.redis = new Redis(redisUrl);
    }

    async createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
        const id = `${randomUUID()}`;
        const now = new Date();
        const fullTask: Task = {
            ...task,
            id,
            createdAt: now,
            updatedAt: now,
        };

        await this.redis.set(`task:${id}`, JSON.stringify(fullTask));
        return fullTask;
    }

    async getTask(id: string): Promise<Task | null> {
        const data = await this.redis.get(`task:${id}`);
        return data ? JSON.parse(data) : null;
    }

    async updateTask(id: string, update: TaskUpdate): Promise<Task | null> {
        const task = await this.getTask(id);
        if (!task) return null;

        const updatedTask: Task = {
            ...task,
            ...update,
            updatedAt: new Date(),
        };

        await this.redis.set(`task:${id}`, JSON.stringify(updatedTask));
        return updatedTask;
    }

    async cancelTask(id: string): Promise<boolean> {
        const task = await this.getTask(id);
        if (!task || task.status !== 'waiting') return false;

        await this.updateTask(id, { status: 'cancelled' });
        return true;
    }
}
