# sker-searcher


docker run -d -p 15432:5432 -e POSTGRES_USER=root -e POSTGRES_PASSWORD=123qwe -e POSTGRES_DB=postgres postgres



# https://bowongai--comfyui-api-v2-comfyui-api.modal.run

# ElectronFlow 架构设计

## 1. 核心架构原则
1. **模块化设计**：采用主进程+渲染进程分离架构，业务逻辑分层实现
2. **状态管理**：主进程使用Redux管理核心状态，渲染进程通过IPC通信
3. **安全策略**：启用上下文隔离、禁用Node集成、配置CSP策略
4. **性能优化**：Web Worker处理计算密集型任务，懒加载非核心模块

## 2. 技术架构图
```
[Electron Main Process]
├── 核心服务层（Core Service）
│   ├── 系统交互模块
│   ├── 文件管理模块
│   └── 自动更新模块
├── 业务逻辑层（Business Logic）
│   ├── 数据持久化
│   └── 加密处理
└── IPC通信中心

[Renderer Process - React]
├── 视图组件层（Components）
├── 状态管理层（Mobx）
├── 路由管理（React Router）
└── 构建工具（Webpack + Babel）
```

## 3. 关键模块设计
### 3.1 主进程架构
- **多窗口管理**：实现窗口池管理策略
- **异常监控**：Sentry集成+崩溃日志收集
- **自动更新**：增量更新方案（bsdiff算法）

### 3.2 渲染进程架构
- **组件分层**：基础组件/业务组件/容器组件
- **状态同步**：通过IPC与主进程Redux保持同步
- **本地缓存**：IndexedDB + localStorage分级存储

## 4. 工程化方案
- **构建方案**：主进程使用tsc编译，渲染进程Webpack打包
- **代码规范**：ESLint + Prettier + Husky
- **测试策略**：主进程Jest单元测试，渲染进程Cypress E2E测试

## 5. 安全防护体系
- 进程沙箱隔离
- 敏感操作二次验证
- 代码混淆与加密
- 证书签名校验机制

## 6. 性能优化方案
- 首屏加载：代码分割+预加载
- 内存管理：窗口销毁机制+内存泄漏检测
- 资源加载：CDN加速+本地缓存策略