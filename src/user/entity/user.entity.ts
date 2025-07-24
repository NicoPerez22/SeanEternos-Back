import { Team } from 'src/team/entity/team.entity';
import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  email: string;

  @Column()
  password: string;

  @Column()
  idRol: string;

  @Column()
  lastName: string;

  @OneToMany(() => Team, (team) => team.owner)
  teams: Team[];
}
