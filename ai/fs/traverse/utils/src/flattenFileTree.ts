import { FileEntry } from '@fs/traverse-types';

export function flattenFileTree(fileTree: FileEntry[]): FileEntry[] {
    const result: FileEntry[] = [];
    function flatten(entries: FileEntry[]) {
        entries.forEach(entry => {
            result.push(entry);
            if (entry.children) flatten(entry.children);
        });
    }
    flatten(fileTree);
    return result;
}
