import {
  PrimaryGeneratedColumn,
  Column,
  Entity,
  OneToOne,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Tournament } from './tournament.entity';
import { Matches } from './matches.entity';
import { Team } from 'src/team/entity/team.entity';

@Entity({ name: 'rounds' })
export class Rounds {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, default: null })
  name: string;

  @Column()
  round: number;

  @Column()
  home: number;

  @Column()
  away: number;

  @Column({ nullable: true, default: null })
  state: number;

  @Column({ nullable: true, default: null })
  teamWin: number;

  @Column({ nullable: true, default: null })
  teamLose: number;

  @ManyToOne(() => Tournament, (tournament) => tournament.rounds, {
    eager: true,
  })
  tournament: Tournament;

  // @OneToMany(() => Team, (team) => team.tournament)
  // teams: Team[];
}
