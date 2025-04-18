import { CoreTraverser, TraverseStats } from '@fs/traverse-core';

export class StatsCollector {
    static enable(traverser: CoreTraverser) {
        traverser.on('entry', (entry) => {
            // 更新统计信息
        });
    }
}
