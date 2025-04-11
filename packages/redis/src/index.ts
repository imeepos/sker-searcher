import { createClient, RedisClientType, RedisClientOptions } from 'redis';
export * from 'redis';

export class SkerRedisClient {
    private client: RedisClientType;
    private static instance: SkerRedisClient;

    private constructor(options: RedisClientOptions) {
        this.client = createClient(options) as RedisClientType;
    }

    public static getInstance(options: RedisClientOptions): SkerRedisClient {
        if (!SkerRedisClient.instance) {
            SkerRedisClient.instance = new SkerRedisClient(options);
        }
        return SkerRedisClient.instance;
    }

    public async connect(): Promise<void> {
        if (!this.client.isOpen) {
            await this.client.connect();
        }
    }

    public async disconnect(): Promise<void> {
        if (this.client.isOpen) {
            await this.client.disconnect();
        }
    }

    public getClient(): RedisClientType {
        return this.client;
    }

    public async flushAll(): Promise<void> {
        await this.client.flushAll();
    }
}

export function getRedisOptions(): RedisClientOptions {
    return {
        socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(`${process.env.REDIS_PORT || 6379}`),
        },
        password: process.env.REDIS_PASSWORD,
        database: parseInt(`${process.env.REDIS_DB || 0}`)
    };
}

let redisClient: SkerRedisClient;
export async function createRedisClient(): Promise<SkerRedisClient> {
    if (redisClient) {
        if (redisClient.getClient().isOpen) {
            return redisClient;
        }
        await redisClient.connect();
        return redisClient;
    }

    const options = getRedisOptions();
    redisClient = SkerRedisClient.getInstance(options);
    await redisClient.connect();
    return redisClient;
}

export async function useRedisClient<T>(cb: (client: RedisClientType) => Promise<T>): Promise<T> {
    const client = await createRedisClient();
    return await cb(client.getClient());
}

export async function useRedisGet(key: string): Promise<string | null> {
    return await useRedisClient(client => client.get(key));
}

export async function useRedisSet(key: string, value: string, ttl?: number): Promise<void> {
    await useRedisClient(async client => {
        if (ttl) {
            await client.set(key, value, { EX: ttl });
        } else {
            await client.set(key, value);
        }
    });
}

export async function useRedisDel(key: string): Promise<void> {
    await useRedisClient(client => client.del(key));
}

export async function useRedisHGetAll(key: string): Promise<Record<string, string>> {
    return await useRedisClient(client => client.hGetAll(key));
}

export async function useRedisHSet(key: string, field: string, value: string): Promise<void> {
    await useRedisClient(client => client.hSet(key, field, value));
}

export async function useRedisPublish(channel: string, message: string): Promise<void> {
    await useRedisClient(client => client.publish(channel, message));
}

export async function useRedisTransaction<T>(cb: (client: RedisClientType) => Promise<T>): Promise<T> {
    return await useRedisClient(async client => {
        const multi = client.multi();
        const result = await cb(multi as unknown as RedisClientType);
        await multi.exec();
        return result;
    });
}
