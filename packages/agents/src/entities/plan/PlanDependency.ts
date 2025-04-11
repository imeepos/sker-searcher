import { Column, Entity, PrimaryColumn } from "@sker/orm";

@Entity('ai_plan_dependencies')
export class PlanDependency {
    @PrimaryColumn({ name: 'task_id', type: 'varchar', length: 50 })
    taskId: string;

    @PrimaryColumn({ name: 'depends_on', type: 'varchar', length: 50 })
    dependsOnId: string;

    @Column({ name: 'project_id', type: 'int', default: 0 })
    projectId: number;
}