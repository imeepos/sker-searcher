import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from '@sker/orm'
export * from './rule/rule';
export * from './func/func';

@Entity({
    name: 'ai_project'
})
export class AiProject {
    @PrimaryGeneratedColumn({
        primaryKeyConstraintName: 'pk_ai_project_id'
    })
    id: number;

    @Column({
        type: 'varchar',
        length: 255
    })
    name: string;

    @Column({
        type: 'text',
        default: ''
    })
    desc: string;

    @Column({
        type: 'text',
        default: ''
    })
    content: string;
}

@Entity({
    name: 'ai_package_name'
})
export class AiPackageName {
    @PrimaryGeneratedColumn({
        primaryKeyConstraintName: 'pk_ai_package_name_id'
    })
    id: number;

    @Column({
        type: 'varchar',
        comment: '包名',
        default: ``,
        unique: true
    })
    name: string;

    @Column({
        type: 'varchar',
        comment: '包简介',
        default: ``,
        unique: true
    })
    desc: string;

    @Column({
        type: 'text',
        default: ''
    })
    docs: string;
}


@Entity({
    name: 'ai_code'
})
@Unique('uk_package_id_name', ['package_id', 'name'])
export class AiCode {
    @PrimaryGeneratedColumn({
        primaryKeyConstraintName: 'pk_ai_code_id'
    })
    id: number;

    @Column({
        type: 'varchar',
        length: 255
    })
    name: string;

    @Column({
        default: '',
        type: 'text'
    })
    docs: string;

    @Column({
        type: 'text',
        default: ''
    })
    code: string;

    @Column({
        type: 'smallint',
        comment: '函数状态是否通过测试',
        default: 0
    })
    status: number;

    @Column({
        type: 'varchar',
        comment: 'md5',
        default: ``,
        unique: true
    })
    hash: string;

    @Column({
        type: 'int',
        comment: '所属包',
        default: 0
    })
    package_id: number;

    @Column({
        type: 'int',
        comment: '智能体',
        default: 0
    })
    agent_id: number;

    @Column({
        type: 'int',
        comment: '版本号',
        default: 0
    })
    version_id: number;
}

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
        type: 'varchar',
        default: '',
        length: 255
    })
    md5: string;

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
                return Buffer.from(JSON.stringify(val || []), 'utf8').toString('base64')
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
                return Buffer.from(JSON.stringify(val || []), 'utf8').toString('base64')
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
                return Buffer.from(JSON.stringify(val || []), 'utf8').toString('base64')
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
                return Buffer.from(JSON.stringify(val || []), 'utf8').toString('base64')
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
                return Buffer.from(JSON.stringify(val || []), 'utf8').toString('base64')
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