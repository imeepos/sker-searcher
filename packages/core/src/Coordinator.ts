import { defer, forkJoin, from, Observable, Subject } from 'rxjs';
import { concatMap, tap, toArray } from 'rxjs/operators';
import { Agent } from './Agent.js';
import { TaskResult } from './types.js';

export class Coordinator {
    private resultsSubject = new Subject<TaskResult>();

    get results$() {
        return this.resultsSubject.asObservable();
    }
    // 并行执行
    runParallel(agents: Agent[]): Observable<TaskResult[]> {
        return forkJoin(agents.map(agent =>
            defer(() => agent.execute()).pipe(
                tap(result => this.resultsSubject.next(result))
            )
        ))
    }
    // 串行执行
    runSerial(agents: Agent[]): Observable<TaskResult[]> {
        return from(agents)
            .pipe(
                concatMap(agent =>
                    defer(() => agent.execute()).pipe(
                        tap(result => this.resultsSubject.next(result))
                    )
                ),
                toArray()
            )
    }
}
