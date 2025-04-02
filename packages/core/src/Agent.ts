import { defer, Observable, of } from 'rxjs';
import { catchError, mergeMap, retry, tap } from 'rxjs/operators';
import { isTaskResult, TaskResult } from './types.js';
import { Message } from './siliconflow/index.js';

export abstract class Agent<T = any> {
    private retries: number = 3;
    public question: string = ``;
    constructor(
        public readonly name: string,
        public readonly desc: string,
        public readonly prompts: Message[]
    ) { }
    abstract run(): Observable<T>;
    execute(): Observable<TaskResult<T>> {
        return defer(() => this.run())
            .pipe(
                retry(this.retries),
                catchError(error => of({
                    agent: this.name,
                    success: false,
                    data: error instanceof Error ? error : new Error(String(error))
                })),
                mergeMap(data => {
                    if (isTaskResult(data)) return of(data)
                    return of({
                        agent: this.name,
                        success: true,
                        data: data
                    })
                })
            )
    }
}
