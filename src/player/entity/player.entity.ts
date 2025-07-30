import { Team } from 'src/team/entity/team.entity';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'players' })
export class Player {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  lastName: string;

  @Column()
  photo: string;

  @Column()
  valoration: number;

  @Column()
  idTeam: number;

  @Column()
  isHabilitado: boolean;

  @Column()
  position: string;

  @Column()
  isTransfer: boolean;

  @ManyToOne(() => Team, (team) => team.players, { nullable: true })
  team: Team | null;
}
