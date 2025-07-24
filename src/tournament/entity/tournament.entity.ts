import { Rounds } from './rounds.entity';
import { Team } from 'src/team/entity/team.entity';
import {
  PrimaryGeneratedColumn,
  Column,
  Entity,
  OneToOne,
  JoinColumn,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Matches } from './matches.entity';
import { FormatTournament } from 'src/team/entity/format.entity';

@Entity({ name: 'tournament' })
export class Tournament {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true, default: null })
  logo: string;

  @Column({ nullable: true, default: null })
  isActive: boolean;

  @Column({ nullable: true, default: null })
  createdAt: Date;

  @Column({ nullable: true, default: null })
  updatedAt: Date;

  @ManyToMany(() => Team)
  @JoinTable()
  teams: Team[];

  @OneToMany(() => Rounds, (round) => round.tournament)
  rounds: Rounds[];

  @ManyToOne(() => FormatTournament, { nullable: true })
  @JoinColumn({ name: 'formatId' })
  format: FormatTournament;

  @Column({ type: 'json', nullable: true })
  statistics: any;
}
