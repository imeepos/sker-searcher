import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from '@sker/orm'
export * from './rule/rule.js';
export * from './func/func.js';
export * from './agent/agent.js';
export * from './package/package.js';
export * from './project/project.js'
export * from './agent/agentLog.js'

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

