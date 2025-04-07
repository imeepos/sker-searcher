import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "@sker/orm";

@Entity({
    name: 'ai_agent_log'
})
export class AiAgentLog {

    @PrimaryGeneratedColumn({
        primaryKeyConstraintName: `pk_ai_agent_log_id`
    })
    id: number;

    @Column({
        type: 'int',
        default: 0
    })
    agent_id: number;

    @Column({
        type: 'jsonb',
        nullable: true
    })
    prompts: any

    @Column({
        type: 'jsonb',
        nullable: true
    })
    answer: any

    @Column({
        type: 'int',
        default: 0
    })
    score: number;

    @CreateDateColumn()
    create_date: Date;

    @UpdateDateColumn()
    update_date: Date;
}