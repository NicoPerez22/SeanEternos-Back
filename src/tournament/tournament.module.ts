import { Module } from '@nestjs/common';
import { TournamentService } from './tournament.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tournament } from './entity/tournament.entity';
import { TournamentController } from './tournament.controller';
import { Team } from 'src/team/entity/team.entity';
import { Rounds } from './entity/rounds.entity';
import { FormatTournament } from 'src/team/entity/format.entity';
import { Image } from 'src/upload/entity/image.entity';
import { Player } from 'src/player/entity/player.entity';
import { TeamService } from 'src/team/team.service';
import { User } from 'src/user/entity/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FormatTournament,
      Team,
      Rounds,
      Tournament,
      Image,
      Player,
      User,
    ]),
  ],
  controllers: [TournamentController],
  providers: [TournamentService, TeamService],
  exports: [TypeOrmModule],
})
export class TournamentModule {}
