import { defer, Observable, of } from 'rxjs';
import { catchError, mergeMap, retry, tap } from 'rxjs/operators';
import { isTaskResult, TaskResult } from './types';

export abstract class Agent<T = any> {
    private retries: number = 3;
    private question: string = ``;
    constructor(
        public readonly name: string,
        public readonly desc: string
    ) { }
    setQuestion(q: string) {
        this.question = q;
    }
    abstract run(question: string): Observable<T>;
    execute(): Observable<TaskResult<T>> {
        return defer(() => this.run(this.question))
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
