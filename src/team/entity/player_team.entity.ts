import { User } from 'src/user/entity/user.entity';
import { PrimaryGeneratedColumn, Column, Entity, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { Team } from './team.entity';

@Entity({name: 'playersteam'})
export class PlayersTeam {

    @PrimaryGeneratedColumn()
    id: number

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

    @OneToOne(() => User)
    @JoinColumn()
    user: User

    // @ManyToOne(() => Team, (team) => team.players)
    // @JoinColumn()
    // team: Team;
}