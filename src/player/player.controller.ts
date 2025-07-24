import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { PlayerService } from './player.service';

@Controller('player')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Get('sofifa')
  getTeams() {
    return this.playerService.soFifa();
  }

  @Get('')
  getPlayers() {
    return this.playerService.getPlayers();
  }

  @Get('teamId/:id')
  getPlayerByIdTeam(@Param('id', ParseIntPipe) id: number) {
    return this.playerService.getPLayersByIdTeams(id);
  }

  @Post()
  createTeam(@Body() newTeam: any) {
    return this.playerService.createPlayer(newTeam);
  }

  @Delete('playersRemove')
  deletePlayersInAllTeams() {
    return this.playerService.removeAllPlayersFromTeams();
  }

  @Patch(':id')
  updateTeam(@Param('id', ParseIntPipe) id: number, @Body() player: any) {
    return this.playerService.updatePlayer(id, player);
  }

  @Get('transfer/:id/:idTeam')
  transferPlayer(
    @Param('id', ParseIntPipe) id: number,
    @Param('idTeam', ParseIntPipe) idTeam: number,
  ) {
    return this.playerService.transferPlayerToTeam(id, idTeam);
  }
}
