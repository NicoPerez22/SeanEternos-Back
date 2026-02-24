import { TournamentService } from './tournament.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CreateTournamentDto } from './dto/tournament.dto';

@Controller('tournament')
export class TournamentController {
  constructor(private tournamentService: TournamentService) {}

  @Get('formats')
  getFormats() {
    return this.tournamentService.getFormats();
  }

  @Get('admin/match-report-drafts')
  async adminListDrafts(@Query('status') status?: string, @Query('tournamentId') tournamentId?: string) {
    return await this.tournamentService.listDrafts({
      status: status ?? null,
      tournamentId: tournamentId ? Number(tournamentId) : null,
    });
  }

  @Get('admin/match-report-drafts/:draftId')
  async adminGetDraftDetail(@Param('draftId', ParseIntPipe) draftId: number) {
    return await this.tournamentService.getDraftDetail(draftId);
  }

  @Post('admin/match-report-drafts/:draftId/review')
  async adminReviewDraft(
    @Param('draftId', ParseIntPipe) draftId: number,
    @Body() dto: { adminId: number; action: 'approve' | 'reject'; reviewNote?: string }
  ) {
    return await this.tournamentService.reviewDraft(draftId, dto);
  }

  @Post()
  async createTournament(@Body() dto: CreateTournamentDto) {
    return await this.tournamentService.createTournament(dto);
  }

  @Get(':roundId/teams')
  async getTeamsByRound(@Param('roundId', ParseIntPipe) roundId: number) {
    return await this.tournamentService.getTeamsByRound(roundId);
  }

  @Get()
  async getTournaments() {
    return await this.tournamentService.getTournament();
  }

  @Get(':id')
  async getTournamentById(@Param('id') id: number) {
    return await this.tournamentService.getTournamentById(id);
  }

  @Delete('delete/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tournamentService.removeTournament(id);
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
    return this.tournamentService.getRankingLeague(tournamentId);
  }

  @Get(':id/groups')
  getRankingGroups(@Param('id') tournamentId: number) {
    return this.tournamentService.getRankingGroups(tournamentId);
  }

  @Get(':id/highlights')
  getHighlights(@Param('id') tournamentId: number) {
    return this.tournamentService.getHighlights(tournamentId);
  }

  @Get(':id/cards')
  getRedCards(@Param('id') tournamentId: number) {
    return this.tournamentService.getCardsLeaders(tournamentId);
  }

  @Get(':id/:page')
  getRoundsPagination(
    @Param('id') tournamentId: number,
    @Param('page') page: number,
  ) {
    return this.tournamentService.getRoundsPaginated(tournamentId, page);
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

  @Post('preview')
  async preview(@Body() dto: any) {
    return this.tournamentService.createDraft(dto);
  }

  // @Post('match-report-drafts')
  // create(@Body() dto: any) {
  //   return this.tournamentService.createDraft(dto);
  // }
}
