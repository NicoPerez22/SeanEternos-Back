import { TournamentService } from './tournament.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { Tournament } from './entity/tournament.entity';
import { FormatTournament } from 'src/team/entity/format.entity';
import { CreateTournamentDto } from './dto/tournament.dto';

@Controller('tournament')
export class TournamentController {
  constructor(private tournamentService: TournamentService) {}

  @Get('formats')
  getFormats() {
    return this.tournamentService.getFormats();
  }

  @Post()
  async createTournament(@Body() dto: CreateTournamentDto) {
    return await this.tournamentService.createTournament(dto);
  }

  @Get()
  async getTournaments() {
    return await this.tournamentService.getTournament();
  }

  @Get(':id')
  async getTournamentById(@Param('id') id: number) {
    return await this.tournamentService.getTournamentById(id);
  }
}
