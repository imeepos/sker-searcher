import { Column, Entity, PrimaryGeneratedColumn, Unique } from "@sker/orm";


/**
 * 编码规范
 */
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
        type: 'varchar',
        comment: '规范类型',
        default: ``
    })
    type: string;

    @Column({
        default: '',
        type: 'text'
    })
    docs: string;
}

