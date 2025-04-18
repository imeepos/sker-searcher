

# 短期记忆系统使用文档

## 概述
实现对话历史管理，支持自动截断、上下文压缩和Redis持久化。核心功能：
- 基于令牌数的自动内存管理
- FIFO/优先级两种截断策略
- 本地/Redis双存储模式
- 时间衰减与摘要生成

## 快速开始
```typescript
// 初始化基础记忆系统
const memory = new ShortTermMemory(2000);

// 添加对话内容
await memory.addEntry({
  content: "用户问：今天天气如何？",
  timestamp: Date.now(),
  tokens: 20,
  isImportant: false
});

// 获取完整上下文
const context = memory.getContext();
```

## 核心功能

### 1. 内容管理
```typescript
// 创建标准条目
const entry = createMemoryEntry("AI回答：晴转多云", false);

// 批量替换条目
await memory.replaceEntries([entry1, entry2]);

// 自动清理过期内容（60分钟）
memory.applyTimeDecay(60);

// 生成摘要
const summary = await memory.generateSummary();
```

### 2. 截断策略
```typescript
// 使用FIFO策略（默认优先级策略）
const fifoMemory = new ShortTermMemory(2000, new FIFOTruncationStrategy());

// 优先级策略特性：
// - 优先保留标记为isImportant的条目
// - 保留最新和最早的2条非重要条目
```

### 3. 增强系统
```typescript
// 主内存+归档内存组合
const enhanced = new EnhancedMemorySystem(
  { maxTokens: 4000 },  // 主内存
  { maxTokens: 10000 }  // 归档内存
);

// 重要内容双存储
await enhanced.addContent("用户密码：******", true);
```

### 4. Redis集成
```typescript
// 创建Redis客户端
const redisClient = createRedisClient({ url: 'redis://localhost:6379' });

// 创建会话存储
const redisMemory = new RedisMemoryAdapter(redisClient, "session_123");

// 自动同步机制：
// - addEntry时自动持久化
// - getEntries时自动加载最新数据
```

## 配置参数

| 类名                | 参数               | 默认值   | 说明                     |
|--------------------|-------------------|--------|------------------------|
| ShortTermMemory    | maxTokens         | 2000   | 最大令牌容量               |
| PriorityTruncation | -                 | -      | 智能保留重要内容和首尾条目      |
| RedisMemoryAdapter | sessionId         | 必填    | 会话唯一标识符              |
| createRedisClient  | socket.reconnect  | 3秒策略 | 断线重连策略               |

## 注意事项
1. 令牌计算使用`gpt-tokenizer`，需确保文本编码一致性
2. Redis操作自动缓存同步，手动修改需调用persistToRedis()
3. 时间戳单位为毫秒，建议使用Date.now()
4. 系统默认UTF-8编码，特殊字符可能影响令牌计算

## 最佳实践
```typescript
// 典型工作流
const client = createRedisClient();
await client.connect();

const memory = new EnhancedMemorySystem();
const redisAdapter = new RedisMemoryAdapter(client, "user_123");

// 组合使用
await memory.addContent("常规对话内容");
await redisAdapter.addEntry(createMemoryEntry("持久化内容", true));

// 获取混合上下文
const fullContext = await redisAdapter.getEntries();
```


[!NOTE]  
完整类型定义参考源码中的`MemoryEntry`接口，所有异步方法需配合await使用。错误处理建议包裹try-catch块。