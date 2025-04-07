# 基于TypeScript的异步任务队列系统设计

下面我将设计一个完整的异步任务处理系统，使用RabbitMQ作为消息中间件，TypeScript实现，满足所有需求场景。

## 系统架构概览

```
┌─────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Client  │───▶│ API Gateway │───▶│ Task Queue  │───▶│ Worker Node │
└─────────┘    └─────────────┘    └─────────────┘    └─────────────┘
     ▲                ▲                   │                │
     │                │                   │                ▼
     └────────────────┼───────────────────┘         ┌─────────────┐
                      │                              │  Database   │
                      └──────────────────────────────┴─────────────┘
```

## 核心模块实现

### 1. 类型定义 (types.ts)

```typescript
type TaskStatus = 
  | 'pending'     // 等待处理
  | 'processing'  // 处理中
  | 'success'     // 成功
  | 'failed'      // 失败
  | 'error'       // 错误
  | 'cancelled'   // 已取消
  | 'timeout';    // 已超时

interface Task<T = any> {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  status: TaskStatus;
  progress?: number;  // 0-100
  request: T;
  response?: any;
  error?: any;
  timeout?: number;   // 超时时间(ms)
  webhookUrl?: string;
}

interface TaskMessage {
  taskId: string;
  action: 'create' | 'update' | 'cancel';
  payload?: Partial<Task>;
}
```

### 2. 网关层实现 (gateway.ts)

```typescript
import amqp from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import { Task, TaskMessage } from './types';

class TaskGateway {
  private connection: amqp.Connection;
  private channel: amqp.Channel;
  private taskQueue = 'task_queue';
  private statusQueue = 'status_queue';
  
  private taskMap = new Map<string, Task>();
  private longPollingClients = new Map<string, Response>();

  constructor(private db: Database) {}

  async init() {
    this.connection = await amqp.connect('amqp://localhost');
    this.channel = await this.connection.createChannel();
    await this.channel.assertQueue(this.taskQueue, { durable: true });
    await this.channel.assertQueue(this.statusQueue, { durable: true });
    
    // 消费状态更新消息
    this.channel.consume(this.statusQueue, (msg) => {
      if (msg) {
        const taskMsg: TaskMessage = JSON.parse(msg.content.toString());
        this.handleStatusUpdate(taskMsg);
        this.channel.ack(msg);
      }
    });
  }

  async createTask(request: any, options?: { 
    timeout?: number; 
    webhookUrl?: string 
  }): Promise<{ taskId: string }> {
    const taskId = uuidv4();
    const task: Task = {
      id: taskId,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'pending',
      request,
      timeout: options?.timeout,
      webhookUrl: options?.webhookUrl
    };

    // 保存到数据库
    await this.db.saveTask(task);
    
    // 发送到任务队列
    const message: TaskMessage = {
      taskId,
      action: 'create',
      payload: task
    };
    
    this.channel.sendToQueue(
      this.taskQueue,
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );

    return { taskId };
  }

  async getTaskStatus(taskId: string): Promise<Task> {
    const task = await this.db.getTask(taskId);
    if (!task) throw new Error('Task not found');
    return task;
  }

  async cancelTask(taskId: string): Promise<void> {
    const message: TaskMessage = {
      taskId,
      action: 'cancel'
    };
    
    this.channel.sendToQueue(
      this.taskQueue,
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );
  }

  private handleStatusUpdate(message: TaskMessage) {
    const { taskId, action, payload } = message;
    
    // 更新数据库
    const task = this.db.updateTask(taskId, payload);
    
    // 触发webhook
    if (task.webhookUrl) {
      fetch(task.webhookUrl, {
        method: 'POST',
        body: JSON.stringify(task),
        headers: { 'Content-Type': 'application/json' }
      }).catch(console.error);
    }
    
    // 处理长轮询
    const client = this.longPollingClients.get(taskId);
    if (client) {
      client.json(task);
      this.longPollingClients.delete(taskId);
    }
  }

  // HTTP长轮询支持
  async longPollStatus(taskId: string, timeout = 30000): Promise<Task> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.longPollingClients.delete(taskId);
        reject(new Error('Polling timeout'));
      }, timeout);

      this.longPollingClients.set(taskId, {
        json: (data: Task) => {
          clearTimeout(timer);
          resolve(data);
        }
      } as Response);
    });
  }
}
```

### 3. 工作节点实现 (worker.ts)

```typescript
import amqp from 'amqplib';
import { Task, TaskMessage } from './types';

class TaskWorker {
  private channel: amqp.Channel;
  private taskQueue = 'task_queue';
  private statusQueue = 'status_queue';
  
  constructor(private db: Database) {}

  async init() {
    const connection = await amqp.connect('amqp://localhost');
    this.channel = await connection.createChannel();
    
    await this.channel.assertQueue(this.taskQueue, { durable: true });
    await this.channel.assertQueue(this.statusQueue, { durable: true });
    
    // 设置公平分发
    this.channel.prefetch(1);
    
    this.channel.consume(this.taskQueue, async (msg) => {
      if (msg) {
        try {
          const taskMsg: TaskMessage = JSON.parse(msg.content.toString());
          await this.processTask(taskMsg);
          this.channel.ack(msg);
        } catch (err) {
          console.error('Task processing failed:', err);
          this.channel.nack(msg, false, false); // 不重试
        }
      }
    });
  }

  private async processTask(message: TaskMessage) {
    const { taskId, action } = message;
    
    if (action === 'cancel') {
      await this.updateTaskStatus(taskId, { status: 'cancelled' });
      return;
    }

    const task = await this.db.getTask(taskId);
    if (!task) throw new Error('Task not found');
    
    // 检查超时
    if (task.timeout && Date.now() - task.createdAt.getTime() > task.timeout) {
      await this.updateTaskStatus(taskId, { status: 'timeout' });
      return;
    }

    // 开始处理
    await this.updateTaskStatus(taskId, { 
      status: 'processing',
      progress: 0
    });

    try {
      // 模拟任务处理
      const totalSteps = 10;
      for (let i = 1; i <= totalSteps; i++) {
        // 检查是否被取消
        const currentTask = await this.db.getTask(taskId);
        if (['cancelled', 'timeout'].includes(currentTask.status)) {
          return;
        }

        // 处理任务步骤
        await this.processStep(task, i);
        
        // 更新进度
        await this.updateTaskStatus(taskId, {
          progress: (i / totalSteps) * 100
        });
      }

      // 任务完成
      await this.updateTaskStatus(taskId, {
        status: 'success',
        progress: 100,
        response: { result: 'Task completed successfully' }
      });
    } catch (error) {
      await this.updateTaskStatus(taskId, {
        status: error.isExpected ? 'failed' : 'error',
        error: {
          message: error.message,
          stack: error.stack
        }
      });
    }
  }

  private async processStep(task: Task, step: number) {
    // 实际业务逻辑
    await new Promise(resolve => setTimeout(resolve, 1000)); // 模拟耗时操作
    
    // 随机失败示例
    if (Math.random() < 0.1) {
      const err = new Error('Random processing error');
      (err as any).isExpected = true;
      throw err;
    }
  }

  private async updateTaskStatus(taskId: string, update: Partial<Task>) {
    const message: TaskMessage = {
      taskId,
      action: 'update',
      payload: {
        ...update,
        updatedAt: new Date()
      }
    };
    
    this.channel.sendToQueue(
      this.statusQueue,
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );
  }
}
```

### 4. Express API 实现 (api.ts)

```typescript
import express from 'express';
import { TaskGateway } from './gateway';

const app = express();
app.use(express.json());

const gateway = new TaskGateway(db); // 假设有数据库实例
await gateway.init();

// 创建任务
app.post('/tasks', async (req, res) => {
  try {
    const { request, timeout, webhookUrl } = req.body;
    const { taskId } = await gateway.createTask(request, { timeout, webhookUrl });
    res.json({ taskId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取任务状态
app.get('/tasks/:id', async (req, res) => {
  try {
    const task = await gateway.getTaskStatus(req.params.id);
    res.json(task);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// 长轮询状态
app.get('/tasks/:id/wait', async (req, res) => {
  try {
    const task = await gateway.longPollStatus(req.params.id);
    res.json(task);
  } catch (err) {
    res.status(408).json({ error: err.message });
  }
});

// 取消任务
app.delete('/tasks/:id', async (req, res) => {
  try {
    await gateway.cancelTask(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('API server running on port 3000'));
```

## 关键设计说明

1. **状态管理**：
   - 使用7种状态完整覆盖业务场景
   - 每次状态变更都记录时间戳
   - 支持进度百分比跟踪

2. **消息可靠性**：
   - RabbitMQ消息持久化
   - 手动确认机制
   - 公平分发策略

3. **超时处理**：
   - 任务级别超时控制
   - 长轮询超时机制
   - 工作节点处理超时检查

4. **错误处理**：
   - 区分预期失败和意外错误
   - 错误信息完整记录
   - 死信队列支持(可扩展)

5. **扩展性设计**：
   - 任务处理可插拔
   - 支持水平扩展工作节点
   - 数据库抽象层

## 部署建议

1. **RabbitMQ集群**：
   - 3节点集群确保高可用
   - 配置镜像队列
   - 监控队列深度和消费者数量

2. **工作节点**：
   - 根据负载动态伸缩
   - 实现健康检查接口
   - 优雅关闭处理

3. **网关层**：
   - 负载均衡部署
   - 连接池管理
   - 限流保护

这个设计完整实现了所有需求功能，并考虑了生产环境的可靠性要求。可以根据实际业务需求进一步优化性能或添加特定功能。