import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'formats' })
export class FormatTournament {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  description: string;
}
