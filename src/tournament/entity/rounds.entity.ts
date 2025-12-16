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

  @ManyToOne(() => Tournament, (tournament) => tournament.rounds)
  @JoinColumn({ name: 'tournamentId' })
  tournament: Tournament;

  @Column({ name: 'round' })
  round: number;

  // 👇 Estas dos columnas SON esenciales
  @Column({ name: 'home' })
  home: number;

  @Column({ name: 'away' })
  away: number;

  @Column({ nullable: true })
  state: number;

  @Column({ nullable: true })
  teamWin: number;

  @Column({ nullable: true })
  teamLose: number;

  @Column({ default: 0 })
  homeGoals: number;

  @Column({ default: 0 })
  awayGoals: number;

  // 👇 Relaciones correctas (TypeORM ahora sí sabe qué buscar)
  @ManyToOne(() => Team)
  @JoinColumn({ name: 'home' })
  homeTeam: Team;

  @ManyToOne(() => Team)
  @JoinColumn({ name: 'away' })
  awayTeam: Team;
}