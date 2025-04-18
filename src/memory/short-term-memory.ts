/**
 * 短期记忆系统
 * 功能：对话历史维护、自动截断、上下文压缩
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
import { encode } from 'gpt-tokenizer';
import { createClient, RedisClientOptions, RedisClientType } from 'redis';

//#region 强化类型系统
type Milliseconds = number;

export interface MemoryEntry {
    content: string;
    timestamp: number;
    tokens: number;
    isImportant?: boolean;
}

export interface TruncationStrategy {
    truncate(entries: MemoryEntry[], currentTokens: number, maxTokens: number): TruncateResult;
}

export interface MemoryStorage {
    addEntry(entry: MemoryEntry): Promise<void>;
    getEntries(): Promise<MemoryEntry[]>;
    clear(): Promise<void>;
    readonly currentTokens: number;
}

interface TruncateResult {
    entries: MemoryEntry[];
    currentTokens: number;
}

interface MemoryConfig {
    maxTokens: number;
}

interface RedisAdapterConfig extends RedisClientOptions {
    sessionId: string;
    cacheTtl?: Milliseconds;
}
//#endregion

//#region 截断策略优化（添加类型守卫和性能优化）
export class FIFOTruncationStrategy implements TruncationStrategy {
    truncate(entries: MemoryEntry[], currentTokens: number, maxTokens: number): TruncateResult {
        const newEntries = [...entries];
        let removedTokens = 0;

        const overflow = currentTokens - maxTokens;
        if (overflow <= 0) return { entries, currentTokens };

        for (const entry of entries) {
            if (removedTokens >= overflow) break;
            newEntries.shift();
            removedTokens += entry.tokens;
        }

        return {
            entries: newEntries,
            currentTokens: currentTokens - removedTokens
        };
    }
}

export class PriorityTruncationStrategy implements TruncationStrategy {
    private isEligibleForRemoval(entry: MemoryEntry): boolean {
        return !entry.isImportant;
    }

    truncate(entries: MemoryEntry[], currentTokens: number, maxTokens: number): TruncateResult {
        const candidates = entries
            .map((entry, index) => ({ entry, index }))
            .filter(({ entry }) => this.isEligibleForRemoval(entry))
            .reverse();

        let remainingTokens = currentTokens;
        const preservedIndices = new Set<number>(entries.map((_, i) => i));

        for (const { index } of candidates) {
            if (remainingTokens <= maxTokens) break;
            preservedIndices.delete(index);
            remainingTokens -= entries[index].tokens;
        }

        const filteredEntries = entries.filter((_, i) => preservedIndices.has(i));
        return remainingTokens > maxTokens
            ? new FIFOTruncationStrategy().truncate(filteredEntries, remainingTokens, maxTokens)
            : { entries: filteredEntries, currentTokens: remainingTokens };
    }
}
//#endregion

//#region 核心记忆系统（强化内存管理和类型安全）
export class ShortTermMemory implements MemoryStorage {
    private entries: MemoryEntry[] = [];
    private _currentTokens = 0;

    constructor(
        public readonly maxTokens: number,
        private readonly truncationStrategy: TruncationStrategy = new PriorityTruncationStrategy()
    ) { }

    get currentTokens(): number {
        return this._currentTokens;
    }

    async addEntry(entry: MemoryEntry): Promise<void> {
        this.validateEntry(entry);
        this.entries.push(entry);
        this._currentTokens += entry.tokens;
        this.applyTruncation();
    }

    async getEntries(): Promise<MemoryEntry[]> {
        return [...this.entries];
    }

    async clear(): Promise<void> {
        this.entries = [];
        this._currentTokens = 0;
    }

    async replaceEntries(entries: MemoryEntry[]): Promise<void> {
        this.validateEntries(entries);
        this.entries = [...entries];
        this._currentTokens = entries.reduce((sum, e) => sum + e.tokens, 0);
        this.applyTruncation();
    }

    applyTimeDecay(maxAgeMinutes: number): void {
        const cutoff = Date.now() - maxAgeMinutes * 60_000;
        const [filtered, tokens] = this.entries.reduce(
            ([arr, sum], entry) => entry.timestamp >= cutoff
                ? [[...arr, entry], sum + entry.tokens]
                : [arr, sum],
            [[], 0] as [MemoryEntry[], number]
        );
        this.entries = filtered;
        this._currentTokens = tokens;
        this.applyTruncation();
    }

    private applyTruncation(): void {
        const result = this.truncationStrategy.truncate(
            this.entries,
            this._currentTokens,
            this.maxTokens
        );
        this.entries = result.entries;
        this._currentTokens = Math.max(result.currentTokens, 0);
    }

    private validateEntry(entry: MemoryEntry): void {
        if (!entry || typeof entry.content !== 'string') {
            throw new Error('Invalid memory entry structure');
        }
    }

    private validateEntries(entries: MemoryEntry[]): void {
        if (!Array.isArray(entries)) {
            throw new Error('Entries must be an array');
        }
        entries.forEach(this.validateEntry);
    }
}
//#endregion

//#region 增强存储系统（完善错误处理和Redis集成）
export class EnhancedMemorySystem {
    constructor(
        private readonly mainMemory: ShortTermMemory,
        private readonly archivalMemory: MemoryStorage
    ) { }

    static create(config?: {
        main?: MemoryConfig;
        archival?: MemoryConfig;
    }): EnhancedMemorySystem {
        return new EnhancedMemorySystem(
            new ShortTermMemory(config?.main?.maxTokens ?? 4000),
            new ShortTermMemory(config?.archival?.maxTokens ?? 10000)
        );
    }

    async addContent(content: string, isImportant = false): Promise<void> {
        const entry = createMemoryEntry(content, isImportant);
        const tasks: Promise<void>[] = [this.mainMemory.addEntry(entry)];

        if (isImportant) {
            tasks.push(this.archivalMemory.addEntry(entry));
        }

        await Promise.all(tasks).catch(err => {
            throw new MemoryOperationError('Failed to add content', err);
        });
    }
}

export class RedisMemoryAdapter implements MemoryStorage {
    private readonly localCache: ShortTermMemory;
    private readonly redisKey: string;

    constructor(
        private readonly redisClient: RedisClientType,
        config: RedisAdapterConfig
    ) {
        this.localCache = new ShortTermMemory(config.cacheTtl ?? 86400_000);
        this.redisKey = `memory:${config.sessionId}`;
    }

    get currentTokens(): number {
        return this.localCache.currentTokens;
    }

    async addEntry(entry: MemoryEntry): Promise<void> {
        await this.sync();
        await this.localCache.addEntry(entry);
        await this.persist();
    }

    async getEntries(): Promise<MemoryEntry[]> {
        await this.sync();
        return this.localCache.getEntries();
    }

    async clear(): Promise<void> {
        await this.localCache.clear();
        await this.redisClient.del(this.redisKey);
    }

    private async sync(): Promise<void> {
        try {
            const data = await this.redisClient.get(this.redisKey);
            if (!data) return;

            const parsed = JSON.parse(data);
            if (this.isValidMemoryData(parsed)) {
                await this.localCache.replaceEntries(parsed);
            }
        } catch (err) {
            throw new RedisSyncError('Failed to sync with Redis', err as Error);
        }
    }

    private async persist(): Promise<void> {
        try {
            const entries = await this.localCache.getEntries();
            await this.redisClient.setEx(
                this.redisKey,
                Math.floor((this.localCache.maxTokens ?? 86400_000) / 1000),
                JSON.stringify(entries)
            );
        } catch (err) {
            throw new RedisPersistError('Failed to persist to Redis', err as Error);
        }
    }

    private isValidMemoryData(data: unknown): data is MemoryEntry[] {
        return Array.isArray(data) && data.every(e =>
            e && typeof e.content === 'string' &&
            typeof e.timestamp === 'number' &&
            typeof e.tokens === 'number'
        );
    }
}
//#endregion

//#region 工具函数和错误处理（强化类型校验）
export class MemoryOperationError extends Error {
    constructor(message: string, public readonly cause?: Error) {
        super(message);
        this.name = 'MemoryOperationError';
    }
}

export class RedisSyncError extends MemoryOperationError {
    constructor(message: string, cause?: Error) {
        super(message, cause);
        this.name = 'RedisSyncError';
    }
}

export class RedisPersistError extends MemoryOperationError {
    constructor(message: string, cause?: Error) {
        super(message, cause);
        this.name = 'RedisPersistError';
    }
}

export const createRedisClient = (config?: RedisClientOptions): RedisClientType => {
    const client = createClient(config) as RedisClientType;
    client.on('error', err => console.error('Redis client error:', err));
    return client;
};

export const createMemoryEntry = (content: string, isImportant: boolean): MemoryEntry => ({
    content,
    tokens: calculateTokens(content),
    timestamp: Date.now(),
    isImportant
});

const calculateTokens = (content: string): number => {
    try {
        return encode(content).length;
    } catch (err) {
        throw new Error('Token calculation failed', { cause: err });
    }
};

export const MINUTES_TO_MS = (minutes: number): number => minutes * 60_000;
//#endregion
