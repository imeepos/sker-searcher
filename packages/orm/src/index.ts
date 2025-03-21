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
        password: process.env.POSTGRES_PASSWORD
    }
}
export function createDataSource(entities: MixedList<Function | string | EntitySchema>) {
    const options = getDataSourceOptions()
    return new DataSource({
        ...options,
        entities: entities
    })
}
export async function useDataSource<T>(entities: MixedList<Function | string | EntitySchema>, cb: (ds: DataSource) => Promise<T>) {
    const ds = createDataSource(entities)
    await ds.initialize()
    const res = await cb(ds)
    await ds.destroy()
    return res;
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
