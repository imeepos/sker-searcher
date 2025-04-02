import { DataSource, DataSourceOptions, EntityManager, QueryRunner, SelectQueryBuilder, MixedList, EntitySchema } from 'typeorm'
export * from 'typeorm'
export function getDataSourceOptions(): DataSourceOptions {
    return {
        type: 'postgres',
        synchronize: true,
        host: process.env.POSTGRES_HOST || `localhost`,
        port: parseInt(`${process.env.POSTGRES_PORT || 5432}`),
        database: process.env.POSTGRES_DB,
        username: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        poolSize: 30
    }
}

let ds: DataSource;
export async function createDataSource(entities: MixedList<Function | string | EntitySchema>) {
    if (ds) {
        if (ds.isInitialized) {
            return ds;
        }
        await ds.initialize()
        return ds;
    }
    const options = getDataSourceOptions()
    ds = new DataSource({
        ...options,
        entities: entities
    })
    await ds.initialize()
    return ds;
}
export async function useDataSource<T>(entities: MixedList<Function | string | EntitySchema>, cb: (ds: DataSource) => Promise<T>) {
    const ds = await createDataSource(entities)
    ds.setOptions({
        entities: entities
    })
    return await cb(ds)
}
export async function useEntityManager<T>(entities: MixedList<Function | string | EntitySchema>, cb: (m: EntityManager) => Promise<T>) {
    return await useDataSource(entities, (ds) => cb(ds.createEntityManager()))
}
export async function useEntityManagerTransaction<T>(entities: MixedList<Function | string | EntitySchema>, cb: (m: EntityManager) => Promise<T>) {
    return await useDataSource(entities, (ds) => ds.transaction(m => cb(m)))
}
export async function useQueryBuilder<T>(entities: MixedList<Function | string | EntitySchema>, cb: (m: SelectQueryBuilder<any>) => Promise<T>) {
    return await useDataSource(entities, (ds) => cb(ds.createQueryBuilder()))
}
export async function useQueryRunner<T>(entities: MixedList<Function | string | EntitySchema>, cb: (m: QueryRunner) => Promise<T>) {
    return await useDataSource(entities, (ds) => cb(ds.createQueryRunner()))
}
export async function useQuery<T>(entities: MixedList<Function | string | EntitySchema>, query: string, parameters?: any[]): Promise<T> {
    return await useEntityManager(entities, r => r.query<T>(query, parameters))
}
