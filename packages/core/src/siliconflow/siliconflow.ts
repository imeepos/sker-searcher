import { AxiosRequestConfig } from "axios";
import { SkerAxios } from "../skerAxios.js";


export class Siliconflow<D, T> extends SkerAxios<D, T> {
    constructor(config: AxiosRequestConfig<D>) {
        super({
            baseURL: `https://api.siliconflow.cn`,
            ...config
        })
    }
}