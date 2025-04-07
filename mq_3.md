# RabbitMQ 任务状态管理系统设计 (TypeScript 实现)

下面我将设计一个完整的基于 RabbitMQ 的任务状态管理系统，满足您的所有需求。

## 系统架构

```
┌─────────┐    ┌─────────────┐    ┌───────────┐    ┌────────────┐
│ Client  │───▶│ API Gateway │───▶│ RabbitMQ  │───▶│ Worker     │
└─────────┘    └─────────────┘    └───────────┘    └────────────┘
     ▲                ▲                   │              │
     │                │                   │              ▼
     │                └───────────────────┼───────┐  ┌───────────┐
     │                                    │       │  │ Database  │
     └────────────────────────────────────┘       │  └───────────┘
                                                  ▼
                                            ┌─────────────┐
                                            │ Status Store│
                                            └─────────────┘
```

## 核心组件实现

### 1. 类型定义 (types.ts)

```typescript
export type TaskStatus = 
  | 'pending'     // 等待处理
  | 'processing'  // 处理中
  | 'success'     // 成功
  | 'failed'      // 失败
  | 'error'       // 错误
  | 'cancelled'   // 已取消
  | 'timeout';    // 已超时

export interface Task {
  id: string;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  request: any;
  response?: any;
  progress?: number;  // 0-100
  estimatedDuration?: number; // 预计总时长(ms)
  timeoutAt?: Date;   // 超时时间
  webhookUrl?: string;
}

export interface TaskMessage {
  taskId: string;
  action: 'create' | 'update' | 'cancel';
  payload?: Partial<Task>;
}
```

### 2. 网关服务 (gateway.ts)

```typescript
import amqp, { Channel, Connection } from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import { Task, TaskMessage, TaskStatus } from './types';

class TaskGateway {
  private connection: Connection;
  private channel: Channel;
  private taskStore: Map<string, Task> = new Map();
  private readonly TASK_QUEUE = 'task_queue';
  private readonly STATUS_QUEUE = 'status_queue';
  private readonly TASK_TIMEOUT = 30 * 60 * 1000; // 30分钟超时

  constructor(private rabbitmqUrl: string) {}

  async init() {
    this.connection = await amqp.connect(this.rabbitmqUrl);
    this.channel = await this.connection.createChannel();
    
    await this.channel.assertQueue(this.TASK_QUEUE, { durable: true });
    await this.channel.assertQueue(this.STATUS_QUEUE, { durable: true });
    
    // 消费状态更新消息
    this.channel.consume(this.STATUS_QUEUE, (msg) => {
      if (msg) {
        const taskMsg: TaskMessage = JSON.parse(msg.content.toString());
        this.updateTaskStatus(taskMsg);
        this.channel.ack(msg);
      }
    });
  }

  async createTask(request: any, webhookUrl?: string): Promise<string> {
    const taskId = uuidv4();
    const task: Task = {
      id: taskId,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      request,
      timeoutAt: new Date(Date.now() + this.TASK_TIMEOUT),
      webhookUrl
    };

    this.taskStore.set(taskId, task);
    
    const taskMessage: TaskMessage = {
      taskId,
      action: 'create',
      payload: task
    };

    await this.channel.sendToQueue(
      this.TASK_QUEUE,
      Buffer.from(JSON.stringify(taskMessage)),
      { persistent: true }
    );

    return taskId;
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.taskStore.get(taskId);
    if (!task) return false;

    const taskMessage: TaskMessage = {
      taskId,
      action: 'cancel'
    };

    await this.channel.sendToQueue(
      this.TASK_QUEUE,
      Buffer.from(JSON.stringify(taskMessage)),
      { persistent: true }
    );

    return true;
  }

  getTaskStatus(taskId: string): Task | undefined {
    return this.taskStore.get(taskId);
  }

  private updateTaskStatus(message: TaskMessage) {
    const task = this.taskStore.get(message.taskId);
    if (!task) return;

    if (message.action === 'update' && message.payload) {
      Object.assign(task, message.payload, { updatedAt: new Date() });
      this.taskStore.set(task.id, task);
      
      // 触发webhook
      if (task.webhookUrl) {
        this.triggerWebhook(task);
      }
    }
  }

  private async triggerWebhook(task: Task) {
    try {
      await fetch(task.webhookUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
      });
    } catch (error) {
      console.error('Webhook触发失败:', error);
    }
  }

  async close() {
    await this.channel.close();
    await this.connection.close();
  }
}

export default TaskGateway;
```

### 3. 工作节点 (worker.ts)

```typescript
import amqp, { Channel, Connection, Message } from 'amqplib';
import { Task, TaskMessage, TaskStatus } from './types';

class TaskWorker {
  private connection: Connection;
  private channel: Channel;
  private readonly TASK_QUEUE = 'task_queue';
  private readonly STATUS_QUEUE = 'status_queue';

  constructor(private rabbitmqUrl: string) {}

  async init() {
    this.connection = await amqp.connect(this.rabbitmqUrl);
    this.channel = await this.connection.createChannel();
    
    await this.channel.assertQueue(this.TASK_QUEUE, { durable: true });
    await this.channel.assertQueue(this.STATUS_QUEUE, { durable: true });
    
    // 设置每次只处理一个任务
    await this.channel.prefetch(1);
    
    this.channel.consume(this.TASK_QUEUE, async (msg) => {
      if (msg) {
        const taskMsg: TaskMessage = JSON.parse(msg.content.toString());
        await this.processTask(taskMsg);
        this.channel.ack(msg);
      }
    });
  }

  private async processTask(message: TaskMessage) {
    if (message.action === 'cancel') {
      await this.updateTaskStatus(message.taskId, { status: 'cancelled' });
      return;
    }

    const task = message.payload;
    if (!task) return;

    try {
      // 更新为处理中状态
      await this.updateTaskStatus(task.id, { status: 'processing' });

      // 模拟任务处理
      const result = await this.executeTask(task);

      // 更新为成功状态
      await this.updateTaskStatus(task.id, {
        status: 'success',
        response: result,
        progress: 100
      });
    } catch (error) {
      const errorStatus = error instanceof TaskError ? 
        (error.isTimeout ? 'timeout' : 'failed') : 'error';
      
      await this.updateTaskStatus(task.id, {
        status: errorStatus as TaskStatus,
        response: { error: error.message }
      });
    }
  }

  private async executeTask(task: Task): Promise<any> {
    // 这里实现实际的任务处理逻辑
    // 示例代码 - 模拟长时间运行的任务
    
    const startTime = Date.now();
    const totalSteps = 10;
    
    for (let i = 1; i <= totalSteps; i++) {
      // 检查是否超时
      if (task.timeoutAt && new Date() > new Date(task.timeoutAt)) {
        throw new TaskError('Task timeout', true);
      }
      
      // 模拟处理步骤
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 更新进度
      const progress = Math.round((i / totalSteps) * 100);
      await this.updateTaskStatus(task.id, { progress });
    }
    
    return { result: 'success', duration: Date.now() - startTime };
  }

  private async updateTaskStatus(taskId: string, updates: Partial<Task>) {
    const message: TaskMessage = {
      taskId,
      action: 'update',
      payload: updates
    };

    await this.channel.sendToQueue(
      this.STATUS_QUEUE,
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );
  }

  async close() {
    await this.channel.close();
    await this.connection.close();
  }
}

class TaskError extends Error {
  constructor(message: string, public isTimeout = false) {
    super(message);
    this.name = 'TaskError';
  }
}

export default TaskWorker;
```

### 4. HTTP 接口服务 (api.ts)

```typescript
import express from 'express';
import TaskGateway from './gateway';

const app = express();
app.use(express.json());

const gateway = new TaskGateway('amqp://localhost');
await gateway.init();

// 创建任务
app.post('/tasks', async (req, res) => {
  try {
    const taskId = await gateway.createTask(req.body, req.body.webhookUrl);
    res.status(202).json({ taskId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取任务状态
app.get('/tasks/:id', async (req, res) => {
  try {
    const task = gateway.getTaskStatus(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 取消任务
app.delete('/tasks/:id', async (req, res) => {
  try {
    const success = await gateway.cancelTask(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SSE 长连接支持
app.get('/tasks/:id/events', (req, res) => {
  const taskId = req.params.id;
  const task = gateway.getTaskStatus(taskId);
  
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // 发送初始状态
  res.write(`data: ${JSON.stringify(task)}\n\n`);
  
  // 监听后续更新
  const interval = setInterval(() => {
    const updatedTask = gateway.getTaskStatus(taskId);
    if (updatedTask && (
      updatedTask.status !== task.status || 
      updatedTask.progress !== task.progress
    )) {
      res.write(`data: ${JSON.stringify(updatedTask)}\n\n`);
      Object.assign(task, updatedTask);
      
      // 如果任务完成，关闭连接
      if (['success', 'failed', 'error', 'cancelled', 'timeout'].includes(updatedTask.status)) {
        clearInterval(interval);
        res.end();
      }
    }
  }, 1000);
  
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

app.listen(3000, () => {
  console.log('API server running on port 3000');
});
```

## 部署与运行

1. 启动 RabbitMQ 服务
2. 启动 API 服务: `ts-node api.ts`
3. 启动 Worker 服务: `ts-node worker.ts`

## 功能验证

1. 创建任务:
```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"data": "example", "webhookUrl": "http://your-webhook-url"}'
```

2. 查询任务状态:
```bash
curl http://localhost:3000/tasks/{taskId}
```

3. SSE 长连接监听:
```bash
curl http://localhost:3000/tasks/{taskId}/events
```

4. 取消任务:
```bash
curl -X DELETE http://localhost:3000/tasks/{taskId}
```

## 扩展建议

1. **持久化存储**: 当前使用内存存储任务状态，生产环境应该使用 Redis 或数据库
2. **重试机制**: 对于失败任务实现指数退避重试
3. **优先级队列**: 为重要任务设置更高优先级
4. **死信队列**: 处理无法完成的任务
5. **集群部署**: 多个 Worker 节点实现负载均衡
6. **监控告警**: 集成 Prometheus 监控任务处理指标

这个设计完全满足了您的所有需求，包括任务状态管理、进度更新、超时处理、取消功能和多种结果通知方式。