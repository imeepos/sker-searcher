# RabbitMQ 任务队列系统设计 (TypeScript 实现)

下面是一个基于 TypeScript 和 RabbitMQ 的任务队列系统设计，满足您的所有需求。

## 1. 系统架构

```typescript
// 系统主要组件
interface TaskSystem {
  gateway: GatewayService;      // 网关层
  queue: QueueService;          // 队列服务
  worker: WorkerService;        // 工作节点
  storage: StorageService;      // 存储服务 (Redis + DB)
  notifier: NotificationService;// 通知服务
}
```

## 2. 核心类型定义

```typescript
enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  ERROR = 'error',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout'
}

interface Task {
  id: string;                   // 任务唯一ID
  createdAt: Date;              // 创建时间
  updatedAt: Date;              // 最后更新时间
  status: TaskStatus;           // 当前状态
  progress: number;             // 进度 0-100
  request: any;                 // 原始请求数据
  response?: any;               // 响应数据
  error?: any;                  // 错误信息
  timeout?: number;             // 超时时间(ms)
  metadata?: Record<string, any>; // 元数据
}

interface TaskUpdate {
  status?: TaskStatus;
  progress?: number;
  response?: any;
  error?: any;
}
```

## 3. 网关层实现 (GatewayService)

```typescript
class GatewayService {
  private taskMap = new Map<string, Task>(); // 内存中的任务映射
  
  constructor(
    private queueService: QueueService,
    private storageService: StorageService,
    private notifier: NotificationService
  ) {}

  // 提交新任务
  async submitTask(request: any, timeoutMs = 30000): Promise<{ taskId: string }> {
    const taskId = generateUUID();
    const task: Task = {
      id: taskId,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: TaskStatus.PENDING,
      progress: 0,
      request,
      timeout: timeoutMs
    };

    // 保存到内存和Redis
    this.taskMap.set(taskId, task);
    await this.storageService.saveTask(task);
    
    // 入队列
    await this.queueService.enqueue(taskId, request);
    
    return { taskId };
  }

  // 查询任务状态
  async getTaskStatus(taskId: string): Promise<Task> {
    // 先从内存查，再从Redis查
    const task = this.taskMap.get(taskId) || await this.storageService.getTask(taskId);
    if (!task) throw new Error('Task not found');
    return task;
  }

  // 取消任务
  async cancelTask(taskId: string): Promise<void> {
    const task = await this.getTaskStatus(taskId);
    if ([TaskStatus.SUCCESS, TaskStatus.FAILED, TaskStatus.ERROR].includes(task.status)) {
      throw new Error('Cannot cancel completed task');
    }
    
    const updatedTask = await this.storageService.updateTask(taskId, {
      status: TaskStatus.CANCELLED,
      updatedAt: new Date()
    });
    
    this.taskMap.set(taskId, updatedTask);
    await this.queueService.cancelTask(taskId);
    this.notifier.notifyChange(taskId, updatedTask);
  }

  // 创建状态变更的Observable (RxJS)
  createStatusObservable(taskId: string): Observable<Task> {
    return this.notifier.createTaskObservable(taskId);
  }
}
```

## 4. 队列服务 (QueueService)

```typescript
class QueueService {
  private channel: amqp.Channel;
  
  constructor(private connection: amqp.Connection) {
    this.initChannel();
  }

  private async initChannel() {
    this.channel = await this.connection.createChannel();
    await this.channel.assertQueue('tasks', { durable: true });
    await this.channel.assertQueue('task_updates', { durable: true });
  }

  // 入队列
  async enqueue(taskId: string, request: any): Promise<void> {
    await this.channel.sendToQueue('tasks', Buffer.from(JSON.stringify({
      taskId,
      request
    })), { persistent: true });
  }

  // 取消任务
  async cancelTask(taskId: string): Promise<void> {
    await this.channel.sendToQueue('task_updates', Buffer.from(JSON.stringify({
      taskId,
      action: 'cancel'
    })), { persistent: true });
  }

  // 发布进度更新
  async publishProgress(taskId: string, progress: number): Promise<void> {
    await this.channel.sendToQueue('task_updates', Buffer.from(JSON.stringify({
      taskId,
      action: 'progress',
      progress
    })), { persistent: true });
  }
}
```

## 5. 工作节点 (WorkerService)

```typescript
class WorkerService {
  private processingTasks = new Map<string, NodeJS.Timeout>();
  
  constructor(
    private queueService: QueueService,
    private storageService: StorageService,
    private notifier: NotificationService
  ) {
    this.startConsuming();
  }

  private async startConsuming() {
    const channel = await this.queueService.getChannel();
    
    // 消费任务队列
    channel.consume('tasks', async (msg) => {
      if (!msg) return;
      
      const { taskId, request } = JSON.parse(msg.content.toString());
      
      try {
        // 更新状态为处理中
        const task = await this.storageService.updateTask(taskId, {
          status: TaskStatus.PROCESSING,
          updatedAt: new Date()
        });
        this.notifier.notifyChange(taskId, task);
        
        // 设置超时处理
        const timeout = task.timeout || 30000;
        const timeoutId = setTimeout(() => this.handleTimeout(taskId), timeout);
        this.processingTasks.set(taskId, timeoutId);
        
        // 处理任务 (实际业务逻辑)
        await this.processTask(taskId, request);
        
        // 清理
        clearTimeout(timeoutId);
        this.processingTasks.delete(taskId);
        channel.ack(msg);
      } catch (error) {
        channel.nack(msg);
      }
    });
    
    // 消费任务更新队列 (如取消)
    channel.consume('task_updates', async (msg) => {
      if (!msg) return;
      
      const { taskId, action, progress } = JSON.parse(msg.content.toString());
      
      if (action === 'cancel') {
        await this.handleCancellation(taskId);
      } else if (action === 'progress') {
        await this.updateProgress(taskId, progress);
      }
      
      channel.ack(msg);
    });
  }

  private async processTask(taskId: string, request: any) {
    try {
      // 模拟处理过程
      for (let i = 0; i <= 100; i += 10) {
        await delay(500); // 模拟处理延迟
        await this.updateProgress(taskId, i);
      }
      
      // 处理成功
      await this.storageService.updateTask(taskId, {
        status: TaskStatus.SUCCESS,
        progress: 100,
        updatedAt: new Date(),
        response: { result: 'success' }
      });
      
      this.notifier.notifyChange(taskId, await this.storageService.getTask(taskId));
    } catch (error) {
      await this.storageService.updateTask(taskId, {
        status: TaskStatus.ERROR,
        updatedAt: new Date(),
        error: error.message
      });
      
      this.notifier.notifyChange(taskId, await this.storageService.getTask(taskId));
    }
  }

  private async updateProgress(taskId: string, progress: number) {
    const task = await this.storageService.updateTask(taskId, {
      progress,
      updatedAt: new Date()
    });
    this.notifier.notifyChange(taskId, task);
  }

  private async handleCancellation(taskId: string) {
    const timeoutId = this.processingTasks.get(taskId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.processingTasks.delete(taskId);
    }
    
    const task = await this.storageService.updateTask(taskId, {
      status: TaskStatus.CANCELLED,
      updatedAt: new Date()
    });
    
    this.notifier.notifyChange(taskId, task);
  }

  private async handleTimeout(taskId: string) {
    this.processingTasks.delete(taskId);
    
    const task = await this.storageService.updateTask(taskId, {
      status: TaskStatus.TIMEOUT,
      updatedAt: new Date()
    });
    
    this.notifier.notifyChange(taskId, task);
  }
}
```

## 6. 存储服务 (StorageService)

```typescript
class StorageService {
  constructor(
    private redisClient: RedisClient,
    private dbClient: DatabaseClient
  ) {}

  async saveTask(task: Task): Promise<void> {
    // Redis存储最新状态
    await this.redisClient.set(`task:${task.id}`, JSON.stringify(task));
    
    // 数据库存储完整记录
    await this.dbClient.insert('tasks', task);
  }

  async getTask(taskId: string): Promise<Task | null> {
    const taskStr = await this.redisClient.get(`task:${taskId}`);
    return taskStr ? JSON.parse(taskStr) : null;
  }

  async updateTask(taskId: string, update: TaskUpdate): Promise<Task> {
    const existing = await this.getTask(taskId);
    if (!existing) throw new Error('Task not found');
    
    const updatedTask = {
      ...existing,
      ...update,
      updatedAt: new Date()
    };
    
    await this.saveTask(updatedTask);
    return updatedTask;
  }
}
```

## 7. 通知服务 (NotificationService)

```typescript
class NotificationService {
  private observers = new Map<string, Subject<Task>>();
  
  // 通知状态变更
  notifyChange(taskId: string, task: Task): void {
    const subject = this.observers.get(taskId);
    if (subject) {
      subject.next(task);
    }
    
    // 如果任务完成，清理观察者
    if ([TaskStatus.SUCCESS, TaskStatus.FAILED, TaskStatus.ERROR, TaskStatus.CANCELLED, TaskStatus.TIMEOUT].includes(task.status)) {
      this.cleanupObserver(taskId);
    }
  }
  
  // 创建可观察对象
  createTaskObservable(taskId: string): Observable<Task> {
    let subject = this.observers.get(taskId);
    if (!subject) {
      subject = new Subject<Task>();
      this.observers.set(taskId, subject);
    }
    return subject.asObservable();
  }
  
  // 清理观察者
  private cleanupObserver(taskId: string): void {
    const subject = this.observers.get(taskId);
    if (subject) {
      subject.complete();
      this.observers.delete(taskId);
    }
  }
}
```

## 8. Webhook 支持

```typescript
class WebhookService {
  private webhooks = new Map<string, string[]>(); // taskId -> webhook URLs
  
  constructor(private notifier: NotificationService) {
    this.setupNotificationHandling();
  }
  
  registerWebhook(taskId: string, url: string): void {
    if (!this.webhooks.has(taskId)) {
      this.webhooks.set(taskId, []);
    }
    this.webhooks.get(taskId)!.push(url);
  }
  
  private setupNotificationHandling(): void {
    this.notifier.createTaskObservable('*').subscribe(async (task) => {
      const urls = this.webhooks.get(task.id);
      if (urls && urls.length > 0) {
        await Promise.all(urls.map(url => 
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task)
          }).catch(console.error)
        ));
      }
    });
  }
}
```

## 9. 使用示例

```typescript
// 初始化服务
const redisClient = new RedisClient();
const dbClient = new DatabaseClient();
const amqpConnection = await amqp.connect('amqp://localhost');

const storageService = new StorageService(redisClient, dbClient);
const notifier = new NotificationService();
const queueService = new QueueService(amqpConnection);
const workerService = new WorkerService(queueService, storageService, notifier);
const gateway = new GatewayService(queueService, storageService, notifier);
const webhookService = new WebhookService(notifier);

// 提交任务
const { taskId } = await gateway.submitTask({ action: 'process_data' });

// 注册webhook
webhookService.registerWebhook(taskId, 'https://example.com/webhook');

// 通过HTTP轮询获取状态
app.get('/task/:id', async (req, res) => {
  const task = await gateway.getTaskStatus(req.params.id);
  res.json(task);
});

// 通过RxJS获取实时更新
app.get('/task/:id/stream', (req, res) => {
  const observable = gateway.createStatusObservable(req.params.id);
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const subscription = observable.subscribe({
    next: task => {
      res.write(`data: ${JSON.stringify(task)}\n\n`);
    },
    complete: () => {
      res.end();
    }
  });
  
  req.on('close', () => {
    subscription.unsubscribe();
  });
});
```

## 10. 关键点说明

1. **任务状态管理**：完整的状态机实现，覆盖所有需求场景
2. **实时通知**：支持Webhook和SSE两种实时通知方式
3. **超时处理**：内置超时自动取消机制
4. **进度更新**：支持按关键节点或时间比例更新进度
5. **持久化**：Redis存储最新状态，数据库存储完整历史
6. **可观测性**：RxJS实现的状态变更观察
7. **错误处理**：完善的错误处理机制

这个设计满足了您所有的需求点，并提供了良好的扩展性。您可以根据实际业务需求调整具体实现细节。