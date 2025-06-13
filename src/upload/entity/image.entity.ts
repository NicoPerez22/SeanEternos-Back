import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'image' })
export class Image {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  publicId: string;

  @Column()
  secureUrl: string;

  @Column()
  originalName: string;
}
