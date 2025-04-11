import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "@sker/orm";
import { PlanStatus } from "./types.js";

@Entity('ai_plan_logs')
export class PlanLog {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'task_id', type: 'varchar', length: 50 })
    taskId: string;

    @Column({
        type: 'varchar',
        nullable: false,
        length: 24,
        default: 'pending'
    })
    status: PlanStatus;

    @Column({ type: 'text', nullable: true })
    message?: string;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;
}