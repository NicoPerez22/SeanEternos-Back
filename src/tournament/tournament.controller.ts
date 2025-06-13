import { TournamentService } from './tournament.service';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { Tournament } from './entity/tournament.entity';
import { FormatTournament } from 'src/team/entity/format.entity';

@Controller('tournament')
export class TournamentController {
  constructor(private tournamentService: TournamentService) {}

  @Get('formats')
  getFormats() {
    return this.tournamentService.getFormats();
  }

  // @Get()
  // getTournament(): Promise<Tournament[]> {
  //   return this.tournamentService.getTournament();
  // }

  // @Post()
  // createTournament(@Body() tournament: any) {
  //   return this.tournamentService.createTournament(tournament);
  // }

  // @Get(':id')
  // getTournamentByID(@Param('id', ParseIntPipe) id: number) {
  //   return this.tournamentService.getTournamentById(id);
  // }
}
