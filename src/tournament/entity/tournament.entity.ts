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
} from 'typeorm';
import { Matches } from './matches.entity';

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

  // @OneToMany(() => Team, (team) => team.tournament)
  // teams: Team[];

  @OneToMany(() => Rounds, (round) => round.tournament)
  rounds: Rounds[];
}
