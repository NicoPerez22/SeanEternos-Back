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
} from '@nestjs/common';

@Controller('team')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  getTeams() {
    return this.teamService.getTeams();
  }

  @Get('draft')
  draft(@Body() teams: []) {
    return this.teamService.distributePlayersEqually(teams);
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
  updateTeam(@Param('id', ParseIntPipe) id: number, @Body() user: any) {
    return this.teamService.updateTeam(id, user);
  }

  @Delete(':id')
  deleteTeam(@Param('id', ParseIntPipe) id: number) {
    return this.teamService.delete(id);
  }
}
