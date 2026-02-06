import { TournamentService } from 'src/tournament/tournament.service';
import { TeamService } from './team.service';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  ParseIntPipe,
  Patch,
  Delete,
  Query,
} from '@nestjs/common';

@Controller('team')
export class TeamController {
  constructor(
    private readonly teamService: TeamService,
    private readonly tournamentService: TournamentService
  ) {}

  @Get()
  getTeams() {
    return this.teamService.getTeams();
  }

  @Get(':id')
  getTeamsByID(@Param('id', ParseIntPipe) id: number) {
    return this.teamService.getTeamByID(id);
  }

  @Post()
  createTeam(@Body() newTeam: any) {
    return this.teamService.createTeam(newTeam);
  }

  @Get('assingUser/:teamId/:id')
  assignTeamToUser(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.teamService.assignTeamToUser(teamId, id);
  }

  @Patch(':id')
  updateTeam(@Param('id', ParseIntPipe) id: number, @Body() team: any) {
    return this.teamService.updateTeam(id, team);
  }

  @Delete(':id')
  deleteTeam(@Param('id', ParseIntPipe) id: number) {
    return this.teamService.delete(id);
  }

  @Get(':id/stats')
  getTeamStats(
    @Param('id') teamId: number,
    @Query('tournamentId') tournamentId: number,
  ) {
    return this.tournamentService.getTeamStats(teamId, tournamentId);
  }
}
