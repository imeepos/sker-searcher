import { defer, Observable, of } from 'rxjs';
import { catchError, mergeMap, retry, tap } from 'rxjs/operators';
import { TaskResult } from './types';

export abstract class Agent<T = any> {
    private retries: number = 3;
    constructor(
        public readonly id: string
    ) { }
    abstract run(): Observable<TaskResult<T>>;
    execute(): Observable<TaskResult> {
        return defer(() => this.run())
            .pipe(
                retry(this.retries),
                catchError(error => of({
                    agentId: this.id,
                    success: false,
                    error: error instanceof Error ? error : new Error(String(error))
                })),
                tap(result => {
                    if (!result.success) {
                        console.error(`Agent ${this.id} failed after ${this.retries} retries`);
                    }
                }),
                mergeMap(data => of({
                    agentId: this.id,
                    success: true,
                    data
                }))
            )
    }
}
