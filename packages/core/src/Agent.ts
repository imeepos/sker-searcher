import { defer, Observable, of } from 'rxjs';
import { catchError, mergeMap, retry, tap } from 'rxjs/operators';
import { TaskResult } from './types';

export abstract class Agent<T = any> {
    private retries: number = 3;
    private question: string = ``;
    constructor(
        public readonly id: string
    ) { }
    setQuestion(q: string) {
        this.question = q;
    }
    abstract run(question: string): Observable<T>;
    execute(): Observable<TaskResult> {
        return defer(() => this.run(this.question))
            .pipe(
                retry(this.retries),
                catchError(error => of({
                    agentId: this.id,
                    success: false,
                    error: error instanceof Error ? error : new Error(String(error))
                })),
                tap(result => {
                    console.log(result)
                }),
                mergeMap(data => of({
                    agentId: this.id,
                    success: true,
                    data
                }))
            )
    }
}
