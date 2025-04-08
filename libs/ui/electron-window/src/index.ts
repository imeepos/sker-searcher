import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';

type WindowState = {
    id: string;
    window: BrowserWindow;
    isDestroyed: boolean;
};

class ElectronWindowManager {
    private static instance: ElectronWindowManager;
    private windows = new Map<string, WindowState>();

    private constructor() { }

    static getInstance(): ElectronWindowManager {
        if (!ElectronWindowManager.instance) {
            ElectronWindowManager.instance = new ElectronWindowManager();
        }
        return ElectronWindowManager.instance;
    }

    createWindow(
        id: string,
        options: BrowserWindowConstructorOptions
    ): BrowserWindow {
        if (this.windows.has(id) && !this.windows.get(id)?.isDestroyed) {
            throw new Error(`Window with id ${id} already exists`);
        }

        const window = new BrowserWindow({
            ...options,
            webPreferences: {
                ...options.webPreferences,
                nodeIntegration: true,
                contextIsolation: false
            }
        });

        window.on('closed', () => {
            const state = this.windows.get(id);
            if (state) {
                state.isDestroyed = true;
            }
        });

        this.windows.set(id, { id, window, isDestroyed: false });
        return window;
    }

    getWindow(id: string): BrowserWindow | undefined {
        return this.windows.get(id)?.window;
    }

    getAllWindows(): BrowserWindow[] {
        return Array.from(this.windows.values())
            .filter(state => !state.isDestroyed)
            .map(state => state.window);
    }

    closeWindow(id: string): void {
        const state = this.windows.get(id);
        if (state && !state.isDestroyed) {
            state.window.destroy();
        }
    }

    closeAllWindows(): void {
        this.getAllWindows().forEach(window => window.destroy());
    }
}

export const windowManager = ElectronWindowManager.getInstance();