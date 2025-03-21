import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from '@sker/orm'

@Entity({
    name: 'ai_agent'
})
export class AiAgent {

    @PrimaryGeneratedColumn({
        primaryKeyConstraintName: 'pk_ai_agent_id'
    })
    id: number;

    @Column({
        name: 'name',
        type: 'varchar',
        length: 64,
        default: ''
    })
    name: string;

    @Column({
        name: 'desc',
        type: 'varchar',
        length: 255,
        default: ``
    })
    desc: string;

    @Column({
        type: 'int',
        default: 0
    })
    parent_id: number;

    @CreateDateColumn()
    create_date: Date;

    @UpdateDateColumn()
    update_date: Date;
}


@Entity({
    name: 'ai_agent_version'
})
export class AiAgentVersion {
    @PrimaryGeneratedColumn({
        name: 'pk_ai_agent_version'
    })
    id: number;

    @Column({
        type: 'int',
        default: 0
    })
    agent_id: number;

    @Column({
        type: 'int',
        default: 0
    })
    version: number;

    @Column({
        type: 'text',
        nullable: true,
        transformer: {
            from: (val: string) => {
                try {
                    return JSON.parse(Buffer.from(val, 'base64').toString('utf8'))
                } catch (e) {
                    return {};
                }
            },
            to: (val: any) => {
                return Buffer.from(JSON.stringify(val), 'utf8').toString('base64')
            }
        }
    })
    prompts: any[]
}

@Entity({
    name: 'ai_agent_error'
})
export class AiAgentError {
    @PrimaryGeneratedColumn({
        primaryKeyConstraintName: 'pk_ai_agent_error'
    })
    id: number;

    @Column({
        type: 'text',
        nullable: true,
        transformer: {
            from: (val: string) => {
                try {
                    return JSON.parse(Buffer.from(val, 'base64').toString('utf8'))
                } catch (e) {
                    return {};
                }
            },
            to: (val: any) => {
                return Buffer.from(JSON.stringify(val), 'utf8').toString('base64')
            }
        }
    })
    prompts: any[]

    @Column({
        type: 'text',
        nullable: true,
        transformer: {
            from: (val: string) => {
                try {
                    return JSON.parse(Buffer.from(val, 'base64').toString('utf8'))
                } catch (e) {
                    return {};
                }
            },
            to: (val: any) => {
                return Buffer.from(JSON.stringify(val), 'utf8').toString('base64')
            }
        }
    })
    errors: any[];

    @CreateDateColumn()
    create_date: Date;
}

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
        type: 'int',
        default: 0
    })
    version_id: number;

    @Column({
        type: 'text',
        nullable: true,
        transformer: {
            from: (val: string) => {
                try {
                    return JSON.parse(Buffer.from(val, 'base64').toString('utf8'))
                } catch (e) {
                    return {};
                }
            },
            to: (val: any) => {
                return Buffer.from(JSON.stringify(val), 'utf8').toString('base64')
            }
        }
    })
    prompts: any[]

    @Column({
        type: 'text',
        nullable: true,
        transformer: {
            from: (val: string) => {
                try {
                    return JSON.parse(Buffer.from(val, 'base64').toString('utf8'))
                } catch (e) {
                    return {};
                }
            },
            to: (val: any) => {
                return Buffer.from(JSON.stringify(val), 'utf8').toString('base64')
            }
        }
    })
    answer: any[]

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