import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

interface TraverseOptions {
    /**
     * 要忽略的文件或文件夹名称模式
     * 可以是字符串、正则表达式或函数
     */
    ignore?: RegExp | string | ((name: string, isDirectory: boolean, isSymbolicLink: boolean) => boolean);
    /**
     * 是否包含当前文件夹本身
     * @default false
     */
    includeSelf?: boolean;
    /**
     * 最大递归深度
     * @default Infinity
     */
    maxDepth?: number;
    /**
     * 是否只返回文件
     * @default false
     */
    filesOnly?: boolean;
    /**
     * 是否只返回文件夹
     * @default false
     */
    directoriesOnly?: boolean;
    /**
     * 是否跟随符号链接
     * @default false
     */
    followSymlinks?: boolean;
    /**
     * 是否使用缓存
     * @default false
     */
    useCache?: boolean;
    /**
     * 是否收集性能统计信息
     * @default false
     */
    collectStats?: boolean;
}

interface FileEntry {
    path: string;
    name: string;
    isDirectory: boolean;
    isSymbolicLink: boolean;
    size?: number;
    mtime?: Date;
    children?: FileEntry[];
}

interface TraverseStats {
    totalFiles: number;
    totalDirectories: number;
    totalSymbolicLinks: number;
    startTime: Date;
    endTime?: Date;
    durationMs?: number;
    cacheHits: number;
    cacheMisses: number;
}

class DirectoryTraverser extends EventEmitter {
    private cache: Map<string, FileEntry[]> = new Map();
    private stats: TraverseStats = {
        totalFiles: 0,
        totalDirectories: 0,
        totalSymbolicLinks: 0,
        startTime: new Date(),
        cacheHits: 0,
        cacheMisses: 0
    };
    private watchers: Map<string, fs.FSWatcher> = new Map();

    /**
     * 同步遍历文件夹
     */
    traverseDirectorySync(dirPath: string, options: TraverseOptions = {}): FileEntry[] {
        this.stats = {
            totalFiles: 0,
            totalDirectories: 0,
            totalSymbolicLinks: 0,
            startTime: new Date(),
            cacheHits: 0,
            cacheMisses: 0
        };

        const result = this._traverseDirectorySync(dirPath, options);

        this.stats.endTime = new Date();
        this.stats.durationMs = this.stats.endTime.getTime() - this.stats.startTime.getTime();

        if (options.collectStats) {
            this.emit('stats', this.stats);
        }

        return result;
    }

    /**
     * 异步遍历文件夹
     */
    async traverseDirectory(dirPath: string, options: TraverseOptions = {}): Promise<FileEntry[]> {
        this.stats = {
            totalFiles: 0,
            totalDirectories: 0,
            totalSymbolicLinks: 0,
            startTime: new Date(),
            cacheHits: 0,
            cacheMisses: 0
        };

        const result = await this._traverseDirectory(dirPath, options);

        this.stats.endTime = new Date();
        this.stats.durationMs = this.stats.endTime.getTime() - this.stats.startTime.getTime();

        if (options.collectStats) {
            this.emit('stats', this.stats);
        }

        return result;
    }

    /**
     * 流式遍历文件夹
     */
    traverseDirectoryAsStream(dirPath: string, options: TraverseOptions = {}): EventEmitter {
        const stream = new EventEmitter();
        this.stats = {
            totalFiles: 0,
            totalDirectories: 0,
            totalSymbolicLinks: 0,
            startTime: new Date(),
            cacheHits: 0,
            cacheMisses: 0
        };

        process.nextTick(async () => {
            try {
                await this._streamTraverse(dirPath, options, stream);
                this.stats.endTime = new Date();
                this.stats.durationMs = this.stats.endTime.getTime() - this.stats.startTime.getTime();

                if (options.collectStats) {
                    stream.emit('stats', this.stats);
                }

                stream.emit('end');
            } catch (error) {
                stream.emit('error', error);
            }
        });

        return stream;
    }

    /**
     * 监听目录变化
     */
    watchDirectory(dirPath: string, options: TraverseOptions = {}, callback: (changes: FileEntry[]) => void): () => void {
        if (!fs.existsSync(dirPath)) {
            throw new Error(`Directory does not exist: ${dirPath}`);
        }

        const stats = this._getStats(dirPath, options.followSymlinks || false);
        if (!stats.isDirectory()) {
            throw new Error(`Path is not a directory: ${dirPath}`);
        }

        // 初始扫描
        const initialScan = this.traverseDirectorySync(dirPath, options);
        callback(initialScan);

        // 设置监听
        const watcher = fs.watch(dirPath, { recursive: true }, async (eventType, filename) => {
            if (!filename) return;

            const fullPath = path.join(dirPath, filename);
            try {
                const newScan = this.traverseDirectorySync(dirPath, options);
                callback(newScan);
            } catch (error) {
                this.emit('watchError', error);
            }
        });

        this.watchers.set(dirPath, watcher);

        // 返回取消监听函数
        return () => {
            watcher.close();
            this.watchers.delete(dirPath);
        };
    }

    /**
     * 清除缓存
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * 获取最后一次遍历的统计信息
     */
    getLastStats(): TraverseStats | null {
        return this.stats.endTime ? this.stats : null;
    }

    private _traverseDirectorySync(dirPath: string, options: TraverseOptions, currentDepth = 0): FileEntry[] {
        const {
            ignore,
            includeSelf = false,
            maxDepth = Infinity,
            filesOnly = false,
            directoriesOnly = false,
            followSymlinks = false,
            useCache = false
        } = options;

        // 检查路径是否存在
        if (!fs.existsSync(dirPath)) {
            throw new Error(`Directory does not exist: ${dirPath}`);
        }

        // 获取路径状态
        const stats = this._getStats(dirPath, followSymlinks);
        if (!stats.isDirectory()) {
            throw new Error(`Path is not a directory: ${dirPath}`);
        }

        // 检查缓存
        const cacheKey = `${dirPath}:${maxDepth}:${filesOnly}:${directoriesOnly}:${followSymlinks}`;
        if (useCache && this.cache.has(cacheKey)) {
            this.stats.cacheHits++;
            return this.cache.get(cacheKey)!;
        }
        this.stats.cacheMisses++;

        // 创建结果数组
        const result: FileEntry[] = [];

        // 如果需要包含当前文件夹本身
        if (includeSelf && currentDepth <= maxDepth) {
            const selfEntry: FileEntry = {
                path: dirPath,
                name: path.basename(dirPath),
                isDirectory: true,
                isSymbolicLink: stats.isSymbolicLink()
            };
            this.stats.totalDirectories++;

            if (currentDepth < maxDepth) {
                selfEntry.children = this._traverseChildrenSync(dirPath, options, currentDepth + 1);
            }
            result.push(selfEntry);
        } else if (currentDepth <= maxDepth) {
            // 否则直接遍历子项
            result.push(...this._traverseChildrenSync(dirPath, options, currentDepth));
        }

        // 更新缓存
        if (useCache) {
            this.cache.set(cacheKey, result);
        }

        return result;
    }

    private _traverseChildrenSync(currentPath: string, options: TraverseOptions, depth: number): FileEntry[] {
        const {
            ignore,
            filesOnly = false,
            directoriesOnly = false,
            followSymlinks = false
        } = options;

        const entries: FileEntry[] = [];
        let items: string[];

        try {
            items = fs.readdirSync(currentPath);
        } catch (error) {
            // 忽略无法读取的目录
            this.emit('warning', `Cannot read directory: ${currentPath}`, error);
            return [];
        }

        for (const item of items) {
            const fullPath = path.join(currentPath, item);
            let stats: fs.Stats;

            try {
                stats = this._getStats(fullPath, followSymlinks);
            } catch (error) {
                // 忽略无法访问的文件/目录
                this.emit('warning', `Cannot access path: ${fullPath}`, error);
                continue;
            }

            const isDirectory = stats.isDirectory();
            const isSymbolicLink = stats.isSymbolicLink();

            // 更新统计信息
            if (isDirectory) this.stats.totalDirectories++;
            else if (isSymbolicLink) this.stats.totalSymbolicLinks++;
            else this.stats.totalFiles++;

            // 检查是否应该忽略此项
            if (this._shouldIgnore(item, isDirectory, isSymbolicLink, ignore)) {
                continue;
            }

            const entry: FileEntry = {
                path: fullPath,
                name: item,
                isDirectory,
                isSymbolicLink,
                size: stats.size,
                mtime: stats.mtime
            };

            // 如果是目录且还有深度，递归遍历
            if (isDirectory && depth < options.maxDepth!) {
                // 如果是符号链接且不跟随，则不递归
                if (isSymbolicLink && !followSymlinks) {
                    continue;
                }
                entry.children = this._traverseChildrenSync(fullPath, options, depth + 1);
            }

            // 根据选项过滤结果
            if ((filesOnly && !isDirectory) ||
                (directoriesOnly && isDirectory) ||
                (!filesOnly && !directoriesOnly)) {
                entries.push(entry);
            }
        }

        return entries;
    }

    private async _traverseDirectory(dirPath: string, options: TraverseOptions, currentDepth = 0): Promise<FileEntry[]> {
        const {
            ignore,
            includeSelf = false,
            maxDepth = Infinity,
            filesOnly = false,
            directoriesOnly = false,
            followSymlinks = false,
            useCache = false
        } = options;

        // 检查路径是否存在
        try {
            await fs.promises.access(dirPath);
        } catch {
            throw new Error(`Directory does not exist: ${dirPath}`);
        }

        // 获取路径状态
        const stats = await this._getStatsAsync(dirPath, followSymlinks);
        if (!stats.isDirectory()) {
            throw new Error(`Path is not a directory: ${dirPath}`);
        }

        // 检查缓存
        const cacheKey = `${dirPath}:${maxDepth}:${filesOnly}:${directoriesOnly}:${followSymlinks}`;
        if (useCache && this.cache.has(cacheKey)) {
            this.stats.cacheHits++;
            return this.cache.get(cacheKey)!;
        }
        this.stats.cacheMisses++;

        // 创建结果数组
        const result: FileEntry[] = [];

        // 如果需要包含当前文件夹本身
        if (includeSelf && currentDepth <= maxDepth) {
            const selfEntry: FileEntry = {
                path: dirPath,
                name: path.basename(dirPath),
                isDirectory: true,
                isSymbolicLink: stats.isSymbolicLink()
            };
            this.stats.totalDirectories++;

            if (currentDepth < maxDepth) {
                selfEntry.children = await this._traverseChildrenAsync(dirPath, options, currentDepth + 1);
            }
            result.push(selfEntry);
        } else if (currentDepth <= maxDepth) {
            // 否则直接遍历子项
            result.push(...await this._traverseChildrenAsync(dirPath, options, currentDepth));
        }

        // 更新缓存
        if (useCache) {
            this.cache.set(cacheKey, result);
        }

        return result;
    }

    private async _traverseChildrenAsync(currentPath: string, options: TraverseOptions, depth: number): Promise<FileEntry[]> {
        const {
            ignore,
            filesOnly = false,
            directoriesOnly = false,
            followSymlinks = false
        } = options;

        const entries: FileEntry[] = [];
        let items: string[];

        try {
            items = await fs.promises.readdir(currentPath);
        } catch (error) {
            // 忽略无法读取的目录
            this.emit('warning', `Cannot read directory: ${currentPath}`, error);
            return [];
        }

        // 使用Promise.all并行处理文件状态
        const entriesPromises = items.map(async (item) => {
            const fullPath = path.join(currentPath, item);
            let stats: fs.Stats;

            try {
                stats = await this._getStatsAsync(fullPath, followSymlinks);
            } catch (error) {
                // 忽略无法访问的文件/目录
                this.emit('warning', `Cannot access path: ${fullPath}`, error);
                return null;
            }

            const isDirectory = stats.isDirectory();
            const isSymbolicLink = stats.isSymbolicLink();

            // 更新统计信息
            if (isDirectory) this.stats.totalDirectories++;
            else if (isSymbolicLink) this.stats.totalSymbolicLinks++;
            else this.stats.totalFiles++;

            // 检查是否应该忽略此项
            if (this._shouldIgnore(item, isDirectory, isSymbolicLink, ignore)) {
                return null;
            }

            const entry: FileEntry = {
                path: fullPath,
                name: item,
                isDirectory,
                isSymbolicLink,
                size: stats.size,
                mtime: stats.mtime
            };

            // 如果是目录且还有深度，递归遍历
            if (isDirectory && depth < options.maxDepth!) {
                // 如果是符号链接且不跟随，则不递归
                if (isSymbolicLink && !followSymlinks) {
                    return entry;
                }
                entry.children = await this._traverseChildrenAsync(fullPath, options, depth + 1);
            }

            return entry;
        });

        // 等待所有Promise完成
        const potentialEntries = await Promise.all(entriesPromises);

        // 过滤掉null值和根据选项过滤
        for (const entry of potentialEntries) {
            if (!entry) continue;

            const { isDirectory } = entry;

            if ((filesOnly && !isDirectory) ||
                (directoriesOnly && isDirectory) ||
                (!filesOnly && !directoriesOnly)) {
                entries.push(entry);
            }
        }

        return entries;
    }

    private async _streamTraverse(currentPath: string, options: TraverseOptions, stream: EventEmitter, depth = 0): Promise<void> {
        const {
            ignore,
            maxDepth = Infinity,
            filesOnly = false,
            directoriesOnly = false,
            followSymlinks = false
        } = options;

        if (depth > maxDepth) return;

        let items: string[];
        try {
            items = await fs.promises.readdir(currentPath);
        } catch (error) {
            // 忽略无法读取的目录
            this.emit('warning', `Cannot read directory: ${currentPath}`, error);
            return;
        }

        for (const item of items) {
            const fullPath = path.join(currentPath, item);
            let stats: fs.Stats;

            try {
                stats = await this._getStatsAsync(fullPath, followSymlinks);
            } catch (error) {
                // 忽略无法访问的文件/目录
                this.emit('warning', `Cannot access path: ${fullPath}`, error);
                continue;
            }

            const isDirectory = stats.isDirectory();
            const isSymbolicLink = stats.isSymbolicLink();

            // 更新统计信息
            if (isDirectory) this.stats.totalDirectories++;
            else if (isSymbolicLink) this.stats.totalSymbolicLinks++;
            else this.stats.totalFiles++;

            // 检查是否应该忽略此项
            if (this._shouldIgnore(item, isDirectory, isSymbolicLink, ignore)) {
                continue;
            }

            const entry: FileEntry = {
                path: fullPath,
                name: item,
                isDirectory,
                isSymbolicLink,
                size: stats.size,
                mtime: stats.mtime
            };

            // 根据选项决定是否发出事件
            if ((filesOnly && !isDirectory) ||
                (directoriesOnly && isDirectory) ||
                (!filesOnly && !directoriesOnly)) {
                stream.emit('data', entry);
            }

            // 如果是目录，递归处理
            if (isDirectory && depth < maxDepth) {
                // 如果是符号链接且不跟随，则不递归
                if (isSymbolicLink && !followSymlinks) {
                    continue;
                }
                await this._streamTraverse(fullPath, options, stream, depth + 1);
            }
        }
    }

    private _getStats(filePath: string, followSymlinks: boolean): fs.Stats {
        return followSymlinks
            ? fs.statSync(filePath)
            : fs.lstatSync(filePath);
    }

    private async _getStatsAsync(filePath: string, followSymlinks: boolean): Promise<fs.Stats> {
        return followSymlinks
            ? fs.promises.stat(filePath)
            : fs.promises.lstat(filePath);
    }

    private _shouldIgnore(
        name: string,
        isDirectory: boolean,
        isSymbolicLink: boolean,
        ignore?: RegExp | string | ((name: string, isDirectory: boolean, isSymbolicLink: boolean) => boolean)
    ): boolean {
        if (!ignore) return false;

        if (typeof ignore === 'string') {
            return name === ignore;
        }

        if (ignore instanceof RegExp) {
            return ignore.test(name);
        }

        if (typeof ignore === 'function') {
            return ignore(name, isDirectory, isSymbolicLink);
        }

        return false;
    }
}

/**
 * 将文件树转换为扁平化数组
 * @param fileTree 文件树
 * @returns 扁平化的文件数组
 */
function flattenFileTree(fileTree: FileEntry[]): FileEntry[] {
    const result: FileEntry[] = [];

    function flatten(entries: FileEntry[]) {
        for (const entry of entries) {
            result.push(entry);
            if (entry.isDirectory && entry.children) {
                flatten(entry.children);
            }
        }
    }

    flatten(fileTree);
    return result;
}

// 使用示例
async function main() {
    const traverser = new DirectoryTraverser();

    // 监听事件
    traverser.on('warning', (message, error) => {
        console.warn('Warning:', message, error);
    });
    traverser.on('stats', (stats: TraverseStats) => {
        console.log('Traversal statistics:', {
            duration: `${stats.durationMs}ms`,
            files: stats.totalFiles,
            directories: stats.totalDirectories,
            symlinks: stats.totalSymbolicLinks,
            cacheHits: stats.cacheHits,
            cacheMisses: stats.cacheMisses
        });
    });

    try {
        const currentDir = process.cwd();

        // 示例1: 同步遍历
        console.log('同步遍历当前目录:');
        const syncResult = traverser.traverseDirectorySync(currentDir, {
            maxDepth: 2,
            collectStats: true
        });
        console.log('Total entries:', flattenFileTree(syncResult).length);

        // 示例2: 异步遍历
        console.log('\n异步遍历当前目录:');
        const asyncResult = await traverser.traverseDirectory(currentDir, {
            ignore: /node_modules|\.git/,
            filesOnly: true,
            collectStats: true,
            useCache: true
        });
        console.log('Files found:', asyncResult.length);

        // 示例3: 流式遍历
        console.log('\n流式遍历当前目录:');
        const stream = traverser.traverseDirectoryAsStream(currentDir, {
            directoriesOnly: true,
            maxDepth: 1,
            collectStats: true
        });

        stream.on('data', (entry: FileEntry) => {
            console.log('Directory:', entry.path);
        });

        await new Promise((resolve) => {
            stream.on('end', resolve);
        });

        // 示例4: 监听目录变化
        console.log('\n监听目录变化:');
        const stopWatching = traverser.watchDirectory(
            path.join(currentDir, 'src'),
            { maxDepth: 1 },
            (entries) => {
                console.log('Directory changed. Total entries:', entries.length);
            }
        );

        // 30秒后停止监听
        setTimeout(() => {
            stopWatching();
            console.log('Stopped watching directory');
        }, 30000);

    } catch (error) {
        console.error('Error:', error);
    }
}

main();
