import axios, { AxiosRequestConfig, Canceler, AxiosInstance } from 'axios'
import { Observable } from 'rxjs'

export class SkerAxios<D, T> {
    private _cancel?: Canceler
    private _axios: AxiosInstance
    private _config: AxiosRequestConfig<D>

    constructor(config: AxiosRequestConfig<D>) {
        this._config = config
        this._config.cancelToken = new axios.CancelToken((cancel: Canceler) => {
            this._cancel = cancel
        })
        this._axios = axios.create()
    }

    public getConfig() {
        return this._config
    }

    async request(config: AxiosRequestConfig<Partial<D>> = {}): Promise<T> {
        this._config = this.mergeConfig(this._config, config)
        return this._axios.request(this._config).then(res => res.data)
    }

    private mergeConfig(prev: any, current: any): any {
        const result = { ...prev }
        for (const key of Object.keys(current)) {
            const currentVal = current[key]
            if (currentVal === undefined) continue // 忽略 undefined 值

            const prevVal = prev[key]

            if (Array.isArray(currentVal)) {
                // 数组处理：拼接新数组
                result[key] = Array.isArray(prevVal)
                    ? [...prevVal, ...currentVal]
                    : currentVal
            } else if (this.isPlainObject(currentVal)) {
                // 对象处理：递归合并
                result[key] = this.isPlainObject(prevVal)
                    ? this.mergeConfig(prevVal, currentVal)
                    : currentVal
            } else {
                // 基础类型处理：直接覆盖
                result[key] = currentVal
            }
        }

        return result
    }

    private isPlainObject(value: any): value is Record<string, any> {
        return typeof value === 'object'
            && value !== null
            && !Array.isArray(value)
    }

    async cancel(msg?: string) {
        return this._cancel && this._cancel(msg)
    }

    run(data: Partial<D>): Observable<T> {
        return new Observable<T>((sub) => {
            this.request({ data: data })
                .then(data => {
                    sub.next(data)
                    sub.complete()
                })
                .catch(e => sub.error(e))
            return () => this.cancel()
        })
    }
}