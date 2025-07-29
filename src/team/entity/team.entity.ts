import { User } from 'src/user/entity/user.entity';
import {
  PrimaryGeneratedColumn,
  Column,
  Entity,
  OneToOne,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { PlayersTeam } from './player_team.entity';
import { Tournament } from 'src/tournament/entity/tournament.entity';
import { Rounds } from 'src/tournament/entity/rounds.entity';
import { Image } from 'src/upload/entity/image.entity';
import { Player } from 'src/player/entity/player.entity';

@Entity({ name: 'teams' })
export class Team {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  idLogo: number;

  @Column()
  abreviatura: string;

  @OneToMany(() => Player, (player) => player.team)
  players: Player[];

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  owner: User | null;
}
