import { ipcMain, ipcRenderer, IpcMainEvent, IpcRendererEvent } from 'electron';

export type Handler<T = any> = (payload: T) => void;

export type EventMap = Record<string, Handler>;

export class ElectronIPCHandler<T extends EventMap> {
    private readonly scope: string;
    private isMain: boolean;

    constructor(scope: string, isMain: boolean) {
        this.scope = scope;
        this.isMain = isMain;
    }

    // 主进程监听方法
    onMain<K extends keyof T>(event: K, handler: T[K]) {
        if (!this.isMain) return;

        ipcMain.on(`${this.scope}:${String(event)}`, (e: IpcMainEvent, payload: Parameters<T[K]>[0]) => {
            handler(payload);
        });
    }

    // 渲染进程监听方法
    onRenderer<K extends keyof T>(event: K, handler: T[K]) {
        if (this.isMain) return;

        ipcRenderer.on(`${this.scope}:${String(event)}`, (e: IpcRendererEvent, payload: Parameters<T[K]>[0]) => {
            handler(payload);
        });
    }

    // 主进程发送到渲染进程
    sendToRenderer<K extends keyof T>(window: Electron.BrowserWindow, event: K, payload: Parameters<T[K]>[0]) {
        if (!this.isMain) return;
        window.webContents.send(`${this.scope}:${String(event)}`, payload);
    }

    // 渲染进程发送到主进程
    sendToMain<K extends keyof T>(event: K, payload: Parameters<T[K]>[0]) {
        if (this.isMain) return;
        ipcRenderer.send(`${this.scope}:${String(event)}`, payload);
    }

    // 双向类型安全调用
    static create<T extends EventMap>(scope: string, isMain: boolean) {
        return new ElectronIPCHandler<T>(scope, isMain);
    }
}
