import { TeamService } from './team.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { TeamController } from './team.controller';
import { Team } from './entity/team.entity';
import { UserModule } from 'src/user/user.module';
import { Tournament } from 'src/tournament/entity/tournament.entity';
import { Rounds } from 'src/tournament/entity/rounds.entity';
import { Image } from 'src/upload/entity/image.entity';
import { Player } from 'src/player/entity/player.entity';
import { User } from 'src/user/entity/user.entity';
import { ImagesService } from 'shared/services/images/images.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Team, Image, Player, User, Rounds]),
    UserModule,
  ],
  controllers: [TeamController],
  providers: [TeamService, ImagesService],
})
export class TeamModule {}
