/**
 * 构建一个用于AI智能体长期记忆系统
 * 开发语言：Typescript
 * 语言：中文
 * 优化下面的代码
 * 0. 修复明显的语法及类型错误
 * 1. 增强类型安全性
 * 2. 提升代码可维护性
 * 3. 优化内存管理策略
 * 4. 完善错误处理机制
 * 5. 适当使用设计模式 提升代码质量
 * 6. 检查并添加适当的region注释
 * 7. 任何情况下不要省略代码
 *  - 如:其他过滤器实现保持不变...
 */

// #region 基础类型和接口
import { readFile, writeFile } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

// 设计模式：策略模式 - 存储策略接口
export interface MemoryStorage {
    save(memories: ReadonlyArray<Memory>): Promise<void>;
    load(): Promise<ReadonlyArray<Memory>>;
}

// 记忆增强元数据接口
export interface EnhancedMetadata {
    readonly importance: number;
    readonly tags: ReadonlyArray<string>;
    lastAccessed?: Date;
    readonly relatedEvents: ReadonlyArray<string>;
    accessCount: number;
    readonly emotionalWeight: number;
}

// 原始记忆数据类型（用于序列化）
export interface RawMemory extends Omit<Memory, 'timestamp' | 'metadata'> {
    readonly timestamp: string;
    readonly metadata: Omit<EnhancedMetadata, 'lastAccessed'> & {
        lastAccessed?: string;
    };
}

// 记忆条目接口
export interface Memory {
    id: string;
    content: string;
    timestamp: Date;
    metadata: EnhancedMetadata;
}

// 记忆检索选项
export interface MemoryQueryOptions {
    keywords?: ReadonlyArray<string>;
    minImportance?: number;
    timeRange?: { start: Date; end: Date };
    tags?: ReadonlyArray<string>;
    relatedEventId?: string;
    limit?: number;
}

// 设计模式：观察者模式 - 记忆更新通知
export interface MemoryObserver {
    onMemoryUpdated(memory: Readonly<Memory>): void;
}
// #endregion

// #region 存储实现
// 设计模式：工厂模式 - 存储策略工厂
export class StorageFactory {
    private constructor() { } // 防止实例化

    static createFileStorage(path: string = 'memory.json'): MemoryStorage {
        return new FileStorage(path);
    }

    static createMemoryStorage(): MemoryStorage {
        return new InMemoryStorage();
    }
}

// 文件存储实现
export class FileStorage implements MemoryStorage {
    constructor(private readonly storagePath: string) { }

    async save(memories: ReadonlyArray<Memory>): Promise<void> {
        try {
            const rawData: RawMemory[] = memories.map(m => ({
                ...m,
                timestamp: m.timestamp.toISOString(),
                metadata: {
                    ...m.metadata,
                    lastAccessed: m.metadata.lastAccessed?.toISOString(),
                    relatedEvents: [...m.metadata.relatedEvents]
                }
            }));
            await writeFile(this.storagePath, JSON.stringify(rawData, null, 2), 'utf-8');
        } catch (error) {
            throw new MemorySystemError('记忆存储失败', error as Error);
        }
    }

    async load(): Promise<Memory[]> {
        try {
            const data = await readFile(this.storagePath, 'utf-8');
            const parsedData = JSON.parse(data) as ReadonlyArray<RawMemory>;

            return parsedData.map(m => ({
                ...m,
                timestamp: new Date(m.timestamp),
                metadata: {
                    ...m.metadata,
                    lastAccessed: m.metadata.lastAccessed ? new Date(m.metadata.lastAccessed) : undefined,
                    relatedEvents: [...m.metadata.relatedEvents]
                }
            }));
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                console.warn('存储文件不存在，初始化新存储');
                return [];
            }
            throw new MemorySystemError('记忆加载失败', error as Error);
        }
    }
}

// 内存存储实现
export class InMemoryStorage implements MemoryStorage {
    private memories: Memory[] = [];

    async save(memories: ReadonlyArray<Memory>): Promise<void> {
        this.memories = memories.map(m => this.deepCopy(m));
    }

    async load(): Promise<Memory[]> {
        return this.memories.map(m => this.deepCopy(m));
    }

    private deepCopy(memory: Readonly<Memory>): Memory {
        return {
            ...memory,
            timestamp: new Date(memory.timestamp),
            metadata: {
                ...memory.metadata,
                lastAccessed: memory.metadata.lastAccessed ? new Date(memory.metadata.lastAccessed) : undefined,
                relatedEvents: [...memory.metadata.relatedEvents]
            }
        };
    }
}
// #endregion

// #region 错误处理
// 自定义错误类型
export class MemorySystemError extends Error {
    constructor(
        message: string,
        public readonly originalError?: Error
    ) {
        super(message);
        this.name = 'MemorySystemError';
        Object.setPrototypeOf(this, MemorySystemError.prototype);
    }
}
// #endregion

// #region 核心系统实现
// 核心记忆系统类
export class LongTermMemorySystem {
    private static readonly DECAY_PERIOD_HOURS = 720; // 衰减周期（小时）
    private readonly memories = new Map<string, Memory>();
    private readonly observers: MemoryObserver[] = [];

    constructor(private readonly storage: MemoryStorage) {
        this.initialize().catch(error =>
            console.error('系统初始化失败:', error)
        );
    }

    // 添加观察者
    addObserver(observer: MemoryObserver): void {
        this.observers.push(observer);
    }

    // 初始化存储
    private async initialize(): Promise<void> {
        try {
            const stored = await this.storage.load();
            stored.forEach(m => this.memories.set(m.id, this.deepCopy(m)));
        } catch (error) {
            throw new MemorySystemError('记忆系统初始化失败', error as Error);
        }
    }

    // 创建记忆
    async createMemory(
        content: string,
        metadata: Omit<EnhancedMetadata, 'lastAccessed' | 'accessCount' | 'relatedEvents'>
    ): Promise<Readonly<Memory>> {
        const memory: Memory = {
            id: uuidv4(),
            content,
            timestamp: new Date(),
            metadata: {
                ...metadata,
                lastAccessed: new Date(),
                accessCount: 0,
                relatedEvents: []
            }
        };

        await this.updateMemory(memory);
        return this.createSnapshot(memory);
    }

    // 记忆检索
    async searchMemories(options: MemoryQueryOptions): Promise<ReadonlyArray<Readonly<Memory>>> {
        let results = Array.from(this.memories.values())
            .map(m => this.applyMemoryEnhancement(m));

        const filterChain = [
            options.minImportance !== undefined && new ImportanceFilter(options.minImportance),
            options.keywords && new KeywordFilter(options.keywords),
            options.timeRange && new TimeRangeFilter(options.timeRange),
            options.tags && new TagFilter(options.tags),
            options.relatedEventId && new RelationFilter(options.relatedEventId)
        ].filter(Boolean) as MemoryFilter[];

        results = filterChain.reduce(
            (acc, filter) => filter.apply(acc),
            results
        );

        return results
            .sort((a, b) => b.metadata.importance - a.metadata.importance)
            .slice(0, options.limit ?? 50)
            .map(m => this.createSnapshot(m));
    }

    // 建立事件关联
    async createAssociation(sourceId: string, targetId: string): Promise<void> {
        const [source, target] = [this.memories.get(sourceId), this.memories.get(targetId)];

        if (!source || !target) {
            throw new MemorySystemError(`无效的记忆ID: ${!source ? sourceId : targetId}`);
        }

        const updatedSource = this.updateRelatedEvents(source, targetId);
        await this.updateMemory(updatedSource);
    }

    // 定期维护任务
    async performMaintenance(): Promise<void> {
        const toDelete = Array.from(this.memories.values())
            .filter(m => this.calculateMemoryValue(m) < 0.2)
            .map(m => m.id);

        toDelete.forEach(id => this.memories.delete(id));

        try {
            await this.storage.save(Array.from(this.memories.values()));
        } catch (error) {
            console.error('维护任务存储失败:', error);
        }
    }

    // #region 私有方法
    private async updateMemory(memory: Memory): Promise<void> {
        const existing = this.memories.get(memory.id);
        const newMemory = existing ? { ...existing, ...memory } : memory;

        this.memories.set(memory.id, newMemory);

        try {
            await this.storage.save(Array.from(this.memories.values()));
            this.notifyObservers(newMemory);
        } catch (error) {
            throw new MemorySystemError('记忆更新失败', error as Error);
        }
    }

    private notifyObservers(memory: Memory): void {
        const snapshot = this.createSnapshot(memory);
        this.observers.forEach(observer => observer.onMemoryUpdated(snapshot));
    }

    private applyMemoryEnhancement(memory: Memory): Memory {
        const enhanced = this.deepCopy(memory);
        const hoursPassed = this.calculateHoursPassed(memory.timestamp);

        enhanced.metadata = {
            ...memory.metadata,
            importance: this.calculateEnhancedImportance(
                memory.metadata.importance,
                hoursPassed,
                memory.metadata.accessCount,
                memory.metadata.relatedEvents.length,
                memory.metadata.emotionalWeight
            ),
            accessCount: memory.metadata.accessCount + 1,
            lastAccessed: new Date()
        };

        return enhanced;
    }

    private calculateEnhancedImportance(
        baseImportance: number,
        hoursPassed: number,
        accessCount: number,
        relationCount: number,
        emotionalWeight: number
    ): number {
        const decayFactor = Math.exp(-hoursPassed / LongTermMemorySystem.DECAY_PERIOD_HOURS);
        const accessBoost = Math.log1p(accessCount) * 0.2;
        const relationBoost = relationCount * 0.1;

        return Math.min(5, Math.max(0,
            baseImportance * decayFactor +
            accessBoost +
            relationBoost +
            emotionalWeight
        ));
    }

    private calculateHoursPassed(timestamp: Date): number {
        return (Date.now() - timestamp.getTime()) / 3_600_000;
    }

    private calculateMemoryValue(memory: Memory): number {
        return this.applyMemoryEnhancement(memory).metadata.importance;
    }

    private updateRelatedEvents(memory: Memory, targetId: string): Memory {
        return {
            ...memory,
            metadata: {
                ...memory.metadata,
                relatedEvents: [...new Set([...memory.metadata.relatedEvents, targetId])]
            }
        };
    }

    private createSnapshot(memory: Memory): Readonly<Memory> {
        return Object.freeze(this.deepCopy(memory));
    }

    private deepCopy(memory: Readonly<Memory>): Memory {
        return {
            ...memory,
            timestamp: new Date(memory.timestamp),
            metadata: {
                ...memory.metadata,
                lastAccessed: memory.metadata.lastAccessed ? new Date(memory.metadata.lastAccessed) : undefined,
                relatedEvents: [...memory.metadata.relatedEvents]
            }
        };
    }
    // #endregion
}
// #endregion

// #region 过滤器实现
// 过滤器抽象类
export abstract class MemoryFilter<T = unknown> {
    constructor(protected readonly options: T) { }

    abstract apply(memories: ReadonlyArray<Memory>): Memory[];
}

// 具体过滤器实现
export class ImportanceFilter extends MemoryFilter<number> {
    apply(memories: ReadonlyArray<Memory>): Memory[] {
        return memories.filter(m => m.metadata.importance >= this.options);
    }
}

export class KeywordFilter extends MemoryFilter<ReadonlyArray<string>> {
    apply(memories: ReadonlyArray<Memory>): Memory[] {
        const keywords = this.options.map(k => k.toLowerCase());
        return memories.filter(m =>
            keywords.some(k => m.content.toLowerCase().includes(k))
        );
    }
}

export class TimeRangeFilter extends MemoryFilter<{ readonly start: Date; readonly end: Date }> {
    apply(memories: ReadonlyArray<Memory>): Memory[] {
        return memories.filter(m =>
            m.timestamp >= this.options.start &&
            m.timestamp <= this.options.end
        );
    }
}

export class TagFilter extends MemoryFilter<ReadonlyArray<string>> {
    apply(memories: ReadonlyArray<Memory>): Memory[] {
        return memories.filter(m =>
            this.options.every(tag => m.metadata.tags.includes(tag))
        );
    }
}

export class RelationFilter extends MemoryFilter<string> {
    apply(memories: ReadonlyArray<Memory>): Memory[] {
        return memories.filter(m =>
            m.metadata.relatedEvents.includes(this.options)
        );
    }
}
// #endregion
