import { InjectionToken } from "@sker/core";
import { Worker } from "@sker/mq";

export const WORKERS: InjectionToken<Worker> = `TASKS`