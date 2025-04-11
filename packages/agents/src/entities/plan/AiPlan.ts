import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "@sker/orm";
import { PlanPriority, PlanStatus } from "./types.js";

@Entity('ai_plan')
@Unique('uk_ai_plan__project_id__id', ['id', 'projectId'])
export class Plan {

    @PrimaryGeneratedColumn({
        primaryKeyConstraintName: 'pk_ai_plan_id'
    })
    pid: number;

    @Column({ type: 'varchar', length: 50 })
    id: string;

    @Column({ type: 'int', default: 0, name: 'project_id' })
    projectId: number;

    @Column({ type: 'varchar', length: 100, nullable: false })
    name: string;

    @Column({ type: 'text', nullable: true })
    description?: string;

    @Column({ type: 'int', default: 0, name: 'parent_id' })
    parentId: number;

    @Column({
        type: 'varchar',
        nullable: false,
        length: 24,
        default: 'pending'
    })
    status: PlanStatus;

    @Column({ type: 'boolean', name: 'is_meta', default: false })
    isMeta: boolean; // 标记是否为元计划

    @Column({
        type: 'varchar',
        nullable: false,
        length: 24,
        default: 'low'
    })
    priority: PlanPriority;

    @Column({ name: 'start_time', type: 'timestamptz', nullable: true })
    startTime?: Date;

    @Column({ name: 'end_time', type: 'timestamptz', nullable: true })
    endTime?: Date;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;
}
