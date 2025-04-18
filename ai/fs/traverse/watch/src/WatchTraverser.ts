import fs from 'fs';
import { CoreTraverser } from '@fs/traverse-core';

export class WatchTraverser {
    static watch(traverser: CoreTraverser, dirPath: string, options: TraverseOptions, callback: Function) {
        const watcher = fs.watch(dirPath, { recursive: true }, () => {
            traverser.traverseDirectory(dirPath, options).then(callback);
        });
        return () => watcher.close();
    }
}
