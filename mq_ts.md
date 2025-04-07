# RabbitMQ 架构设计方案

## 高可用消息队列系统设计

### 集群配置
1. **节点配置**：
   - 至少3个节点组成集群，确保奇数节点数量避免脑裂问题
   - 每个节点配置相同的Erlang cookie以保证节点间通信安全
   - 使用`rabbitmqctl join_cluster`命令将节点加入集群

2. **镜像队列配置**：
   ```bash
   rabbitmqctl set_policy ha-all "^ha\." '{"ha-mode":"all","ha-sync-mode":"automatic"}'
   ```
   - `ha-mode`: 设置为`all`表示在所有节点上镜像队列
   - `ha-sync-mode`: 设置为`automatic`自动同步新加入的镜像

3. **负载均衡策略**：
   - 使用HAProxy或Nginx作为负载均衡器
   - 配置TCP层的负载均衡，监听5672(AMQP)和15672(管理界面)端口
   - 使用round-robin算法分发连接

### 故障恢复机制
1. 节点故障检测：配置RabbitMQ的`autoheal`插件自动处理网络分区
2. 消息持久化：设置队列和消息为持久化(`durable=true`)
3. 确认机制：使用publisher confirms和consumer acknowledgements

## 高吞吐量优化方案

### 队列设计
1. 使用多个队列分散负载，避免单一队列瓶颈
2. 对于不需要严格顺序的消息，使用`x-message-ttl`设置消息过期时间

### 消息持久化策略
```bash
# 只在必要时启用持久化
rabbitmqctl set_policy persistent "^persistent\." '{"queue-mode":"lazy"}'
```

### 消费者预取设置
```typescript
channel.prefetch(100); // 根据消费者处理能力调整
```

### 网络调优
1. 调整TCP缓冲区大小
2. 启用Nagle算法(`channel.tune(1, 65535, 0.5)`)
3. 使用更高效的序列化格式如Protocol Buffers

## 跨数据中心部署方案

### Federation配置
1. 在源集群启用Federation插件：
   ```bash
   rabbitmq-plugins enable rabbitmq_federation
   ```
2. 配置upstream：
   ```bash
   rabbitmqctl set_parameter federation-upstream dc2-upstream \
   '{"uri":"amqp://user:pass@remote-host","expires":3600000}'
   ```
3. 创建policy将特定队列/交换器联合到远程集群

### 故障转移机制
1. 配置多个upstream实现故障转移
2. 设置`reconnect-delay`控制重连间隔
3. 监控Federation链路状态并告警

## 消息积压处理方案

### 监控设置
1. 配置Prometheus监控队列长度
   ```yaml
   - alert: QueueBacklog
     expr: rabbitmq_queue_messages > 10000
     for: 5m
   ```

2. 自动扩展消费者：
   ```typescript
   if (queueLength > threshold) {
     scaleConsumers(queueLength / messagesPerConsumer);
   }
   ```

### 优雅处理积压
1. 优先处理新消息，积压消息降级处理
2. 实现消息优先级队列
3. 设置消息TTL自动清理旧消息

## 安全最佳实践

### TLS加密
1. 生成证书：
   ```bash
   openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365
   ```
2. 配置RabbitMQ：
   ```ini
   listeners.ssl.default = 5671
   ssl_options.cacertfile = /path/to/ca_certificate.pem
   ssl_options.certfile = /path/to/server_certificate.pem
   ssl_options.keyfile = /path/to/server_key.pem
   ```

### 权限控制
```bash
rabbitmqctl set_permissions -p /vhost user ".*" ".*" ".*"
```

### 客户端认证
1. 使用SASL机制
2. 实现自定义认证后端
3. 定期轮换凭据

## 混合云部署架构

### 跨云消息路由
1. 使用Federation连接公有云和私有云实例
2. 配置Shovel插件定向传输特定消息

### 安全连接
1. 建立VPN或专线连接
2. 双向TLS认证
3. 网络ACL限制访问源IP

### 统一管理
1. 使用RabbitMQ Management插件集中监控
2. 实现统一配置管理
3. 集中式日志收集和分析

## TypeScript实现MQ机制

```typescript
interface Task {
  id: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'error' | 'cancelled' | 'timeout';
  progress: number;
  req: any;
  res: any;
  createdAt: Date;
  timeout?: number;
}

class MQGateway {
  private taskMap = new Map<string, Task>();
  private channel: any; // RabbitMQ channel

  constructor() {
    this.initMQ();
  }

  private async initMQ() {
    // 初始化RabbitMQ连接
    const connection = await amqp.connect('amqp://localhost');
    this.channel = await connection.createChannel();
    await this.channel.assertQueue('task_queue', { durable: true });
    await this.channel.assertQueue('status_queue', { durable: true });
    
    // 消费状态更新
    this.channel.consume('status_queue', (msg: any) => {
      const { taskId, status, progress } = JSON.parse(msg.content.toString());
      this.updateTaskStatus(taskId, status, progress);
      this.channel.ack(msg);
    });
  }

  async handleRequest(req: any, res: any) {
    const taskId = uuidv4();
    const task: Task = {
      id: taskId,
      status: 'pending',
      progress: 0,
      req,
      res,
      createdAt: new Date(),
      timeout: 30000 // 30秒超时
    };
    
    this.taskMap.set(taskId, task);
    
    // 发送任务到队列
    this.channel.sendToQueue('task_queue', 
      Buffer.from(JSON.stringify({ taskId, request: req })),
      { persistent: true }
    );
    
    // 设置超时检查
    setTimeout(() => {
      if (this.taskMap.get(taskId)?.status === 'pending') {
        this.updateTaskStatus(taskId, 'timeout');
      }
    }, task.timeout);
    
    return { taskId, status: 'pending' };
  }

  updateTaskStatus(taskId: string, status: Task['status'], progress?: number) {
    const task = this.taskMap.get(taskId);
    if (!task) return;
    
    task.status = status;
    if (progress !== undefined) {
      task.progress = progress;
    }
    
    // 返回结果给客户端
    task.res.json({
      taskId,
      status,
      progress: task.progress
    });
    
    if (['success', 'failed', 'error', 'cancelled', 'timeout'].includes(status)) {
      this.taskMap.delete(taskId);
    }
  }

  cancelTask(taskId: string) {
    if (this.taskMap.get(taskId)?.status === 'pending') {
      this.updateTaskStatus(taskId, 'cancelled');
      // 可以发送取消消息到队列
      return true;
    }
    return false;
  }
}

// 消费者端实现
class TaskWorker {
  private channel: any;

  constructor() {
    this.initWorker();
  }

  private async initWorker() {
    const connection = await amqp.connect('amqp://localhost');
    this.channel = await connection.createChannel();
    await this.channel.assertQueue('task_queue', { durable: true });
    await this.channel.prefetch(10); // 控制并发
    
    this.channel.consume('task_queue', async (msg: any) => {
      const { taskId, request } = JSON.parse(msg.content.toString());
      
      // 更新状态为处理中
      this.updateStatus(taskId, 'processing', 0);
      
      try {
        // 模拟处理过程
        for (let i = 0; i < 10; i++) {
          await this.processStep(request, i);
          this.updateStatus(taskId, 'processing', (i + 1) * 10);
        }
        
        this.updateStatus(taskId, 'success', 100);
      } catch (error) {
        this.updateStatus(taskId, 'failed');
      }
      
      this.channel.ack(msg);
    });
  }

  private updateStatus(taskId: string, status: Task['status'], progress?: number) {
    this.channel.sendToQueue('status_queue', 
      Buffer.from(JSON.stringify({ taskId, status, progress }))
    );
  }

  private async processStep(request: any, step: number) {
    // 实际处理逻辑
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
```

这个实现提供了完整的任务生命周期管理，包括状态更新、进度报告和错误处理。您可以根据实际需求调整队列配置、超时时间和处理逻辑。