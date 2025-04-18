import { CoreTraverser } from '@fs/traverse-core';
import { CacheManager } from '@fs/traverse-cache';
import { StatsCollector } from '@fs/traverse-stats';
import { StreamTraverser } from '@fs/traverse-stream';
import { WatchTraverser } from '@fs/traverse-watch';

export class DirectoryTraverser extends CoreTraverser {
    private cacheManager = new CacheManager();

    traverseDirectoryAsStream(dirPath: string, options: TraverseOptions) {
        return StreamTraverser.stream(this, dirPath, options);
    }

    watchDirectory(dirPath: string, options: TraverseOptions, callback: Function) {
        return WatchTraverser.watch(this, dirPath, options, callback);
    }
}
