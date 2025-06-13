import { PrimaryGeneratedColumn, Column, Entity, OneToOne, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { Tournament } from './tournament.entity';
import { Rounds } from './rounds.entity';

@Entity({name: 'matches'})
export class Matches {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    away: string;

    @Column()
    home: string;

    @Column()
    score: string;

    @Column()
    victory: string;

    @Column()
    lose: string;

    @Column()
    draw: string;

    idRound: number;

    idTournament: number;

    @Column({ nullable: true, default: null })
    createdAt: Date;

    @Column({ nullable: true, default: null })
    updatedAt: Date;

    // @OneToOne(() => Tournament)
    // @JoinColumn()
    tournament: Tournament

    // @OneToOne(() => Rounds)
    // @JoinColumn()
    rounds: Rounds
}