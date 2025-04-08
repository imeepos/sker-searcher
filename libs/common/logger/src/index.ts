export interface LoggerOptions {
    level?: 'debug' | 'info' | 'warn' | 'error';
    prefix?: string;
}

export const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

export function createLogger(options: LoggerOptions = {}) {
    const level = options.level || 'info';
    const prefix = options.prefix ? `[${options.prefix}] ` : '';

    const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
    const isNode = typeof process !== 'undefined' && process.versions?.node;

    function log(level: keyof typeof LOG_LEVELS, ...args: any[]) {
        if (LOG_LEVELS[level] < LOG_LEVELS[level]) return;

        const timestamp = new Date().toISOString();
        const message = `${prefix}${timestamp} [${level.toUpperCase()}]`;

        if (isBrowser) {
            const colors = {
                debug: '#888',
                info: '#09f',
                warn: '#f90',
                error: '#f33'
            };
            console.log(`%c${message}`, `color: ${colors[level]}; font-weight: bold`, ...args);
        } else if (isNode) {
            const colors = {
                debug: '\x1b[90m',
                info: '\x1b[34m',
                warn: '\x1b[33m',
                error: '\x1b[31m'
            };
            const reset = '\x1b[0m';
            console.log(`${colors[level]}${message}${reset}`, ...args);
        } else {
            console.log(message, ...args);
        }
    }

    return {
        debug: (...args: any[]) => log('debug', ...args),
        info: (...args: any[]) => log('info', ...args),
        warn: (...args: any[]) => log('warn', ...args),
        error: (...args: any[]) => log('error', ...args)
    };
}
