import fs from 'fs'
export interface IConfig {
    [key: string]: any;
}

export class ConfigManager {
    private static instance: ConfigManager;
    private config: IConfig = {};
    private watchers: Map<string, Set<Function>> = new Map();

    private constructor() { }

    static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    async load(configPath: string): Promise<void> {
        try {
            const data = await fs.promises.readFile(configPath, 'utf8');
            this.config = JSON.parse(data);
        } catch (error) {
            console.error('Config load failed:', error);
            throw new Error('Failed to load configuration');
        }
    }

    async persist(configPath: string): Promise<void> {
        try {
            await fs.promises.writeFile(configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('Config persist failed:', error);
            throw new Error('Failed to persist configuration');
        }
    }

    get<T = any>(key: string, defaultValue?: T): T {
        const value = this.config[key] ?? defaultValue;
        if (value === undefined) {
            throw new Error(`Config key ${key} not found`);
        }
        return value as T;
    }

    set(key: string, value: any): void {
        const oldValue = this.config[key];
        this.config[key] = value;
        this.notifyChange(key, oldValue, value);
    }

    watch(key: string, callback: (newVal: any, oldVal: any) => void): () => void {
        if (!this.watchers.has(key)) {
            this.watchers.set(key, new Set());
        }
        const listeners = this.watchers.get(key)!;
        listeners.add(callback);
        return () => listeners.delete(callback);
    }

    private notifyChange(key: string, oldVal: any, newVal: any): void {
        const listeners = this.watchers.get(key);
        if (listeners) {
            listeners.forEach(cb => cb(newVal, oldVal));
        }
    }

    // 热更新实现
    enableHotReload(configPath: string, interval = 5000): NodeJS.Timeout {
        return setInterval(async () => {
            try {
                const stats = await fs.promises.stat(configPath);
                if (stats.mtimeMs > (this.lastModified || 0)) {
                    await this.load(configPath);
                    console.log('Configuration hot reloaded');
                    this.lastModified = stats.mtimeMs;
                }
            } catch (error) {
                console.error('Hot reload failed:', error);
            }
        }, interval);
    }

    private lastModified?: number;
}
