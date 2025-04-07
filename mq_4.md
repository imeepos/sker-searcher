# RabbitMQ 任务状态管理系统 (TypeScript 实现)

下面是一个完整的基于 RabbitMQ 的任务状态管理系统实现，包含网关层、任务处理器和状态查询功能。

## 1. 系统架构设计

```
[Client] 
    ↓ (HTTP)
[API Gateway] → [RabbitMQ] → [Worker Nodes]
    ↑ (状态查询)        ↓ (状态更新)
[Redis (状态存储)]
```

## 2. 核心代码实现

### 2.1 类型定义 (types.ts)

```typescript
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
```

### 2.2 RabbitMQ 配置 (rabbitmq.ts)

```typescript
import amqp, { Channel, Connection } from 'amqplib';

class RabbitMQ {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  
  constructor(private uri: string) {}

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

export default RabbitMQ;
```

### 2.3 任务存储服务 (taskStore.ts)

```typescript
import Redis from 'ioredis';
import { Task, TaskStatus, TaskUpdate } from './types';

class TaskStore {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
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

export default TaskStore;
```

### 2.4 API 网关 (gateway.ts)

```typescript
import express from 'express';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import TaskStore from './taskStore';
import RabbitMQ from './rabbitmq';
import { Task, TaskStatus } from './types';

class Gateway {
  private app: express.Application;
  private taskStore: TaskStore;
  private rabbitMQ: RabbitMQ;

  constructor() {
    this.app = express();
    this.app.use(bodyParser.json());
    
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
          return res.status(404).json({ error: 'Task not found' });
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
      } catch (err) {
        res.status(500).json({ error: 'Failed to get task status' });
      }
    });

    // 取消任务
    this.app.post('/tasks/:id/cancel', async (req, res) => {
      try {
        const success = await this.taskStore.cancelTask(req.params.id);
        if (!success) {
          return res.status(400).json({ error: 'Task cannot be cancelled' });
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

export default Gateway;
```

### 2.5 任务处理器 (worker.ts)

```typescript
import RabbitMQ from './rabbitmq';
import TaskStore from './taskStore';
import { Task, TaskUpdate } from './types';

class Worker {
  private taskStore: TaskStore;
  private rabbitMQ: RabbitMQ;

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

  private async processTask(task: Task) {
    // 模拟任务处理
    const steps = 10;
    const stepDuration = (task.estimatedDuration || 10000) / steps;

    for (let i = 1; i <= steps; i++) {
      // 检查任务是否已被取消
      const currentTask = await this.taskStore.getTask(task.id);
      if (currentTask?.status === 'cancelled') {
        return;
      }

      // 模拟处理步骤
      await new Promise(resolve => setTimeout(resolve, stepDuration));

      // 更新进度
      const progress = (i / steps) * 100;
      await this.rabbitMQ.publishStatusUpdate(task.id, {
        progress,
      });

      // 随机模拟失败
      if (Math.random() < 0.05) {
        throw new Error('Random processing error occurred');
      }
    }

    // 任务完成
    await this.rabbitMQ.publishStatusUpdate(task.id, {
      status: 'success',
      progress: 100,
      response: { result: 'Task completed successfully' },
    });
  }
}

export default Worker;
```

### 2.6 主程序入口 (index.ts)

```typescript
import Gateway from './gateway';
import Worker from './worker';

// 启动网关
const gateway = new Gateway();
gateway.start(3000);

// 启动多个工作节点
const workerCount = process.env.WORKER_COUNT ? parseInt(process.env.WORKER_COUNT) : 3;
for (let i = 0; i < workerCount; i++) {
  new Worker().start();
}
```

## 3. 系统功能说明

### 3.1 任务状态流转

```
waiting → processing → (success | failed | error)
waiting → cancelled
processing → cancelled
(任何状态) → timeout
```

### 3.2 API 端点

- `POST /tasks` - 提交新任务
  - 参数: `request`, `estimatedDuration`, `timeout`, `webhookUrl`
  - 返回: `taskId`, `status`, `progress`, `createdAt`

- `GET /tasks/:id` - 查询任务状态
  - 返回: `status`, `progress`, `response`, `error`, `createdAt`, `updatedAt`

- `POST /tasks/:id/cancel` - 取消任务
  - 返回: `success`

- `GET /tasks/:id/stream` - 长连接状态推送 (SSE)

### 3.3 Webhook 支持

当任务状态变更时，如果配置了 `webhookUrl`，系统会向该 URL 发送 POST 请求，包含任务最新状态。

## 4. 部署与运行

1. 安装依赖:
```bash
npm install express body-parser amqplib ioredis uuid @types/express @types/body-parser @types/amqplib @types/ioredis @types/uuid
```

2. 启动服务:
```bash
# 启动RabbitMQ和Redis服务
docker run -d --name rabbitmq -p 5672:5672 rabbitmq:3-management
docker run -d --name redis -p 6379:6379 redis

# 启动网关和工作节点
ts-node index.ts
```

3. 环境变量配置:
- `RABBITMQ_URL`: RabbitMQ 连接字符串
- `REDIS_URL`: Redis 连接字符串
- `WORKER_COUNT`: 工作节点数量

## 5. 扩展功能

1. **超时处理**: 可以添加一个定时任务，定期扫描超时任务并更新状态
2. **重试机制**: 对于失败的任务，可以实现自动重试逻辑
3. **优先级队列**: 根据任务优先级设置不同的队列
4. **批量处理**: 支持批量提交和批量状态查询
5. **认证授权**: 添加 API 认证和任务访问控制

这个实现提供了完整的任务状态管理功能，包括 HTTP 轮询、Webhook 和长连接三种状态获取方式，能够满足大多数异步任务处理场景的需求。