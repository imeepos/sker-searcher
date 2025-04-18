export interface TraverseOptions {
    ignore?: RegExp | string | ((name: string, isDirectory: boolean, isSymbolicLink: boolean) => boolean);
    includeSelf?: boolean;
    maxDepth?: number;
    filesOnly?: boolean;
    directoriesOnly?: boolean;
    followSymlinks?: boolean;
    useCache?: boolean;
    collectStats?: boolean;
}

export interface FileEntry {
    path: string;
    name: string;
    isDirectory: boolean;
    isSymbolicLink: boolean;
    size?: number;
    mtime?: Date;
    children?: FileEntry[];
}

export interface TraverseStats {
    totalFiles: number;
    totalDirectories: number;
    totalSymbolicLinks: number;
    startTime: Date;
    endTime?: Date;
    durationMs?: number;
    cacheHits: number;
    cacheMisses: number;
}
