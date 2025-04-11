import { z } from "zod";

// Define types for our planning flow
type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'failed';
type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

interface Task {
    id: string;
    name: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    dependencies: string[]; // IDs of tasks this task depends on
    startTime?: Date;
    endTime?: Date;
}

export const TaskRule = z.array(z.object({
    id: z.string({ description: '任务唯一标识（必填）, 格式@xxx/xxx 要求：高可读性' }),
    name: z.string({ description: '任务名称（必填）' }),
    description: z.string({ description: '任务详细说明（必填）' }),
    priority: z.enum(['low', 'medium', 'high', 'critical'], {
        description: '任务优先级：低（low）、中（medium）、高（high）、紧急（critical）'
    }),
    dependencies: z.array(z.string(), {
        description: '依赖的任务ID列表，表示当前任务执行前需完成的任务，请务必保证依赖的任务ID是存在的'
    }),
})).min(1)


interface PlanningFlowOptions {
    maxConcurrentTasks?: number;
    onTaskStart?: (task: Task) => void;
    onTaskComplete?: (task: Task) => void;
    onTaskFail?: (task: Task, error: Error) => void;
}

class PlanningFlow {
    private tasks: Map<string, Task>;
    private activeTasks: Set<string>;
    private maxConcurrentTasks: number;
    private onTaskStart: (task: Task) => void;
    private onTaskComplete: (task: Task) => void;
    private onTaskFail: (task: Task, error: Error) => void;

    constructor(options: PlanningFlowOptions = {}) {
        this.tasks = new Map();
        this.activeTasks = new Set();
        this.maxConcurrentTasks = options.maxConcurrentTasks || 5;
        this.onTaskStart = options.onTaskStart || (() => { });
        this.onTaskComplete = options.onTaskComplete || (() => { });
        this.onTaskFail = options.onTaskFail || (() => { });
    }

    /**
     * Add a task to the planning flow
     */
    addTask(task: Omit<Task, 'status' | 'dependencies'> & { dependencies?: string[] }): void {
        const newTask: Task = {
            ...task,
            status: 'pending',
            dependencies: task.dependencies || [],
        };
        this.tasks.set(task.id, newTask);
    }

    /**
     * Get all tasks
     */
    getTasks(): Task[] {
        return Array.from(this.tasks.values());
    }

    /**
     * Get a specific task by ID
     */
    getTask(id: string): Task | undefined {
        return this.tasks.get(id);
    }

    /**
     * Check if a task can be executed (all dependencies are completed)
     */
    private canExecuteTask(taskId: string): boolean {
        const task = this.tasks.get(taskId);
        if (!task) return false;

        return task.dependencies.every(depId => {
            const depTask = this.tasks.get(depId);
            return depTask?.status === 'completed';
        });
    }

    /**
     * Execute a task (simulated - in a real implementation, this would do actual work)
     */
    private async executeTask(taskId: string): Promise<void> {
        const task = this.tasks.get(taskId);
        if (!task) return;

        try {
            // Mark task as in-progress
            task.status = 'in-progress';
            task.startTime = new Date();
            this.activeTasks.add(taskId);
            this.onTaskStart(task);

            // Simulate work with a random delay
            const workDuration = Math.random() * 2000; // up to 2 seconds
            await new Promise(resolve => setTimeout(resolve, workDuration));

            // Randomly fail some tasks for demonstration
            if (Math.random() < 0.1) { // 10% chance of failure
                throw new Error('Simulated task failure');
            }

            // Mark task as completed
            task.status = 'completed';
            task.endTime = new Date();
            this.onTaskComplete(task);
        } catch (error) {
            // Mark task as failed
            if (task) {
                task.status = 'failed';
                task.endTime = new Date();
                this.onTaskFail(task, error as Error);
            }
        } finally {
            this.activeTasks.delete(taskId);
        }
    }

    /**
     * Start executing the planning flow
     */
    async start(): Promise<void> {
        while (this.hasPendingTasks()) {
            // Get all pending tasks that can be executed
            const executableTasks = Array.from(this.tasks.values())
                .filter(task => task.status === 'pending')
                .filter(task => this.canExecuteTask(task.id))
                .sort((a, b) => {
                    // Sort by priority (critical first) then by name
                    const priorityOrder: Record<TaskPriority, number> = {
                        'critical': 0,
                        'high': 1,
                        'medium': 2,
                        'low': 3
                    };
                    return priorityOrder[a.priority] - priorityOrder[b.priority] ||
                        a.name.localeCompare(b.name);
                });

            // Execute tasks up to the concurrency limit
            const tasksToExecute = executableTasks
                .slice(0, this.maxConcurrentTasks - this.activeTasks.size);

            await Promise.all(tasksToExecute.map(task => this.executeTask(task.id)));

            // Small delay to prevent tight looping when no tasks can be executed
            if (tasksToExecute.length === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    }

    /**
     * Check if there are any pending tasks remaining
     */
    private hasPendingTasks(): boolean {
        return Array.from(this.tasks.values()).some(task =>
            task.status === 'pending' ||
            (task.status === 'in-progress' && !this.activeTasks.has(task.id))
        );
    }
}

// Example usage
async function demoPlanningFlow() {
    const flow = new PlanningFlow({
        maxConcurrentTasks: 3,
        onTaskStart: (task) => console.log(`Starting task: ${task.name}`),
        onTaskComplete: (task) => console.log(`Completed task: ${task.name}`),
        onTaskFail: (task, error) => console.error(`Failed task: ${task.name} - ${error.message}`),
    });

    // Add tasks with dependencies
    flow.addTask({ id: 'task1', name: 'Initialize system', priority: 'high' });
    flow.addTask({ id: 'task2', name: 'Load configuration', priority: 'high', dependencies: ['task1'] });
    flow.addTask({ id: 'task3', name: 'Validate data', priority: 'critical', dependencies: ['task2'] });
    flow.addTask({ id: 'task4', name: 'Process records', priority: 'medium', dependencies: ['task3'] });
    flow.addTask({ id: 'task5', name: 'Generate reports', priority: 'medium', dependencies: ['task4'] });
    flow.addTask({ id: 'task6', name: 'Send notifications', priority: 'low', dependencies: ['task5'] });
    flow.addTask({ id: 'task7', name: 'Cleanup temporary files', priority: 'low', dependencies: ['task3'] });
    flow.addTask({ id: 'task8', name: 'Backup database', priority: 'high' });

    console.log('Starting planning flow...');
    await flow.start();
    console.log('Planning flow completed!');

    // Print final status of all tasks
    console.log('\nFinal task status:');
    flow.getTasks().forEach(task => {
        console.log(`${task.name.padEnd(25)} [${task.status}] ${task.startTime ? `started at ${task.startTime.toISOString()}` : ''
            } ${task.endTime ? `ended at ${task.endTime.toISOString()}` : ''
            }`);
    });
}

