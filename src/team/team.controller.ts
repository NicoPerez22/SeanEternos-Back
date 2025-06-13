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
import { Team } from './entity/team.entity';

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

  @Patch(':id')
  updateTeam(@Param('id', ParseIntPipe) id: number, @Body() user: any) {
    return this.teamService.updateTeam(id, user);
  }

  @Delete(':id')
  deleteTeam(@Param('id', ParseIntPipe) id: number) {
    return this.teamService.delete(id);
  }

  // @Post(':id/stats')
  // createStatsTeamByID(
  //     @Param('id', ParseIntPipe) id: number,
  //     @Body() newStast: CreateStatsTeamDTO
  // ){
  //     return this.teamService.createStatsByID(id, newStast)
  // }

  // @Post('player')
  // addPlayerTeam(
  //     @Body() newPlayer: AddPlayerTeamDTO
  // ){
  //     return this.teamService.addPLayerManual(newPlayer)
  // }

  // @Delete('player/:id')
  // deletePlayer(
  //     @Param('id', ParseIntPipe) id: number,
  // ){
  //     return this.teamService.deletePlayer(id)
  // }

  // @Post('sendInvitacion')
  // sendInvitacion(
  //     @Body() invitacion: InvitacionesDTO
  // ){
  //     return this.teamService.sendInvitacion(invitacion)
  // }

  // @Delete('invitacion/:id')
  // deleteInvitacion(
  //     @Param('id', ParseIntPipe) id: number,
  // ){
  //     return this.teamService.deleteInvitacion(id)
  // }

  // @Get('invitacion/:id')
  // getInvitacion(
  //     @Param('id', ParseIntPipe) id: number,
  // ){
  //     return this.teamService.getInvitacion(id)
  // }

  // @Post('acceptInvitacion')
  // acceptInvitacion(
  //     @Body() invitacion: InvitacionesDTO
  // ){
  //     return this.teamService.acceptInvitacion(invitacion)
  // }
}
