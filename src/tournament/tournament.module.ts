import { Module } from '@nestjs/common';
import { TournamentService } from './tournament.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tournament } from './entity/tournament.entity';
import { TournamentController } from './tournament.controller';
import { Team } from 'src/team/entity/team.entity';
import { Rounds } from './entity/rounds.entity';
import { FormatTournament } from 'src/team/entity/format.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([FormatTournament, Team, Rounds, Tournament]),
  ],
  controllers: [TournamentController],
  providers: [TournamentService],
  exports: [TypeOrmModule],
})
export class TournamentModule {}
