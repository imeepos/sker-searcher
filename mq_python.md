# RabbitMQ 任务状态管理系统设计

基于您的要求，我将设计一个完整的 RabbitMQ 任务状态管理系统，包含队列设计、状态流转和异常处理机制。

## 1. 系统架构设计

### 核心组件

- **任务生产者**：接收 HTTP 请求并创建任务
- **任务队列**：RabbitMQ 队列存储待处理任务
- **任务处理器**：消费者节点处理任务
- **状态存储**：数据库记录任务状态和进度
- **状态通知**：可选 WebSocket 或回调通知状态变更

### 队列设计

```
任务主队列(task_queue)
死信队列(task_dlq) - 处理失败/超时的任务
取消队列(cancel_queue) - 处理用户取消请求
```

## 2. 消息结构设计

```json
{
	"task_id": "uuidv4",
	"created_at": "ISO8601",
	"status": "waiting",
	"progress": 0,
	"timeout": 3600, // 超时时间(秒)
	"max_retries": 3,
	"current_retry": 0,
	"payload": {}, // 实际任务数据
	"callback_url": "https://example.com/callback" // 可选
}
```

## 3. 状态流转实现

### 3.1 HTTP 请求入队列 (等待处理)

```python
def create_task(request_data):
    task = {
        "task_id": str(uuid.uuid4()),
        "created_at": datetime.utcnow().isoformat(),
        "status": "waiting",
        "progress": 0,
        "timeout": request_data.get('timeout', 3600),
        "max_retries": request_data.get('max_retries', 3),
        "current_retry": 0,
        "payload": request_data['payload']
    }

    # 存储任务初始状态到数据库
    db.save_task(task)

    # 发布到RabbitMQ
    channel.basic_publish(
        exchange='',
        routing_key='task_queue',
        body=json.dumps(task),
        properties=pika.BasicProperties(
            delivery_mode=2,  # 持久化消息
            headers={
                'x-task-id': task['task_id'],
                'x-retry-count': task['current_retry']
            }
        )
    )

    return {"task_id": task['task_id'], "status": "waiting"}
```

### 3.2 节点处理任务 (处理中 + 进度更新)

```python
def process_task(ch, method, properties, body):
    task = json.loads(body)

    try:
        # 更新状态为"processing"
        update_task_status(task['task_id'], 'processing')

        # 模拟处理过程
        for i in range(1, 101):
            # 执行实际任务处理逻辑
            perform_task_work(task['payload'])

            # 更新进度
            update_task_progress(task['task_id'], i)

            # 检查是否收到取消请求
            if check_cancellation(task['task_id']):
                update_task_status(task['task_id'], 'cancelled')
                ch.basic_ack(method.delivery_tag)
                return

            # 模拟处理时间
            time.sleep(0.1)

        # 处理完成
        update_task_status(task['task_id'], 'success')
        ch.basic_ack(method.delivery_tag)

    except Exception as e:
        handle_task_error(ch, method, task, e)
```

### 3.3 错误处理机制

```python
def handle_task_error(channel, method, task, error):
    task['current_retry'] += 1

    if task['current_retry'] < task['max_retries']:
        # 重试逻辑
        update_task_status(task['task_id'], 'retrying')
        channel.basic_publish(
            exchange='',
            routing_key='task_queue',
            body=json.dumps(task),
            properties=pika.BasicProperties(
                headers={
                    'x-task-id': task['task_id'],
                    'x-retry-count': task['current_retry']
                }
            )
        )
        channel.basic_ack(method.delivery_tag)
    else:
        # 最终失败
        update_task_status(task['task_id'], 'failed', str(error))
        channel.basic_ack(method.delivery_tag)
```

### 3.4 取消任务实现

```python
def cancel_task(task_id):
    # 标记任务为取消状态
    if update_task_status(task_id, 'cancelling'):
        # 发送取消消息到取消队列
        channel.basic_publish(
            exchange='',
            routing_key='cancel_queue',
            body=json.dumps({'task_id': task_id}),
            properties=pika.BasicProperties(
                delivery_mode=2
            )
        )
        return True
    return False
```

### 3.5 超时处理实现

使用 RabbitMQ 的 TTL 和死信队列实现超时机制：

```python
# 创建队列时设置TTL和死信交换
channel.queue_declare(
    queue='task_queue',
    durable=True,
    arguments={
        'x-message-ttl': 3600000, # 1小时TTL
        'x-dead-letter-exchange': 'dlx',
        'x-dead-letter-routing-key': 'task_dlq'
    }
)

# 死信消费者处理超时任务
def process_dlq(ch, method, properties, body):
    task = json.loads(body)
    if is_task_expired(task['task_id']):
        update_task_status(task['task_id'], 'timeout')
    ch.basic_ack(method.delivery_tag)
```

## 4. 数据库设计建议

```sql
CREATE TABLE tasks (
    task_id VARCHAR(36) PRIMARY KEY,
    status ENUM('waiting', 'processing', 'success', 'failed', 'error', 'cancelled', 'timeout') NOT NULL,
    progress INTEGER DEFAULT 0,
    created_at DATETIME NOT NULL,
    started_at DATETIME,
    completed_at DATETIME,
    timeout_seconds INTEGER DEFAULT 3600,
    max_retries INTEGER DEFAULT 3,
    current_retry INTEGER DEFAULT 0,
    error_message TEXT,
    payload JSON,
    callback_url VARCHAR(255)
);

CREATE TABLE task_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(36) NOT NULL,
    event_time DATETIME NOT NULL,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    progress INTEGER,
    FOREIGN KEY (task_id) REFERENCES tasks(task_id)
);
```

## 5. 完整状态流转图

```
[等待处理] --> [处理中] --> [成功]
    |           |           ^
    |           v           |
    |       [重试中] ---- [失败]
    |           |
    v           v
[已取消] <-- [错误]
    ^
    |
[已超时]
```

## 6. 部署建议

1. **RabbitMQ 集群**：配置镜像队列确保高可用
2. **消费者池**：动态扩展消费者实例处理负载
3. **监控**：监控队列长度、消费者数量和任务处理时间
4. **持久化**：确保消息和任务状态都持久化存储

这个设计提供了完整的任务生命周期管理，包括所有您要求的状态转换和异常处理场景。
