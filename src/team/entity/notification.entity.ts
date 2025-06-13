import { User } from 'src/user/entity/user.entity';
import { PrimaryGeneratedColumn, Column, Entity, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { Team } from './team.entity';

@Entity({name: 'invitaciones'})
export class InvitacionesTeam {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    estado: boolean;

    @Column()
    username: string;

    @Column({ nullable: true, default: null })
    createdAt: Date;

    @Column({ nullable: true, default: null })
    updatedAt: Date;

    @Column()
    userId: number;

    @Column()
    teamId: number;

    @Column()
    message: string;

    @Column()
    isTransferencia: boolean;

    @Column()
    isTransferenciaMessage: string;

    @OneToOne(() => User)
    @JoinColumn()
    user: User


}