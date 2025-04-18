import { CoreTraverser } from '@fs/traverse-core';
import { EventEmitter } from 'events';

export class StreamTraverser {
    static stream(traverser: CoreTraverser, dirPath: string, options: TraverseOptions): EventEmitter {
        const stream = new EventEmitter();
        traverser.on('entry', (entry) => stream.emit('data', entry));
        traverser.on('end', () => stream.emit('end'));
        traverser.traverseDirectory(dirPath, options);
        return stream;
    }
}
