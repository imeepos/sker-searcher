
```ts

```

将上述代码合理分化到下面包中：

@fs/traverse-types：类型定义。
@fs/traverse-core：核心遍历逻辑，触发事件。
@fs/traverse-stream：监听entry事件，实现流式输出。
@fs/traverse-stats：监听事件，收集统计信息。
@fs/traverse-cache：监听事件，缓存结果。
@fs/traverse-watch：实现目录监听，触发重新遍历。
@fs/traverse-utils：工具函数。
@fs/traverse-cli：命令行工具。
@fs/traverse：整合所有包，提供统一API。

生成规则：
1. 不要省略实现代码，如： // 实现代码...