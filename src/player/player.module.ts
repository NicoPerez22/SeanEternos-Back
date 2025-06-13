import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayerController } from './player.controller';
import { PlayerService } from './player.service';
import { Player } from './entity/player.entity';
import { Image } from 'src/upload/entity/image.entity';
import { Team } from 'src/team/entity/team.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Player, Image, Team])],
  controllers: [PlayerController],
  providers: [PlayerService],
})
export class PlayerModule {}
