import { TournamentService } from './tournament.service';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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

  @Get(':id/standings')
  getStandings(@Param('id') tournamentId: number) {
    return this.tournamentService.getStandings(tournamentId);
  }

  @Get(':id/stats')
  getTournamentStats(@Param('id') tournamentId: number) {
    return this.tournamentService.getTournamentStats(tournamentId);
  }

  @Get(':id/ranking')
  getRanking(@Param('id') tournamentId: number) {
    return this.tournamentService.getRanking(tournamentId);
  }

  @Get(':id/highlights')
  getHighlights(@Param('id') tournamentId: number) {
    return this.tournamentService.getHighlights(tournamentId);
  }

  @Get(':id/:page/:limit')
  getRoundsPagination(
    @Param('id') tournamentId: number,
    @Param('page') page: number,
    @Param('limit') limit: number,
  ) {
    return this.tournamentService.getRoundsPaginated(tournamentId, page, limit);
  }

  @Post('/report')
  async saveReport(@Body() dto: any) {
    return await this.tournamentService.saveMatchReport(dto);
  }

  @Post(':id/draft/start')
  async startDraft(@Param('id') tournamentId: number) {
    return await this.tournamentService.executeDraftAsync(tournamentId);
  }

  @Get(':id/status')
  getStatusDraft(@Param('id') tournamentId: number) {
    return this.tournamentService.getDraftStatus(tournamentId);
  }
}
