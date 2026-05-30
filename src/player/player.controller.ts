import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PlayerService } from './player.service';
import {
  CreateTransferOfferDto,
  ReviewTransferOfferDto,
} from './dto/transferOffert';

@Controller('player')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Post('transfer/offers')
  create(@Body() dto: CreateTransferOfferDto) {
    return this.playerService.createOffer(dto);
  }

  @Get('')
  getPlayers() {
    return this.playerService.getPlayers();
  }

  @Get('market')
  getPlayersMarket() {
    return this.playerService.getPlayersWithTeams();
  }

  @Get('idTeam/:id')
  getPlayerByIdTeam(@Param('id', ParseIntPipe) id: number) {
    return this.playerService.getPLayersByIdTeams(id);
  }

  @Post()
  createTeam(@Body() newTeam: any) {
    return this.playerService.createPlayer(newTeam);
  }

  @Post('transfer/:id')
  assignTransferPlayer(
    @Param('id', ParseIntPipe) id: number,
    @Body() isTransfer: any,
  ) {
    const transferStatus = isTransfer.isTransfer;
    return this.playerService.assignPlayerTransfer(id, transferStatus);
  }

  @Delete('playersRemove')
  deletePlayersInAllTeams() {
    return this.playerService.removeAllPlayersFromTeams();
  }

  @Patch(':id')
  updatePlayer(@Param('id', ParseIntPipe) id: number, @Body() player: any) {
    return this.playerService.updatePlayer(id, player);
  }

  @Get('transfer/:id/:idTeam')
  transferPlayer(
    @Param('id', ParseIntPipe) id: number,
    @Param('idTeam', ParseIntPipe) idTeam: number,
  ) {
    return this.playerService.transferPlayers(id, idTeam);
  }

  @Get('disabled')
  disablePlayers() {
    return this.playerService.disabledPlayers();
  }

  @Post(':id/:idAdmin/review')
  review(
    @Param('id', ParseIntPipe) id: number,
    @Param('idAdmin', ParseIntPipe) adminId: number,
    @Body() dto: ReviewTransferOfferDto,
  ) {
    return this.playerService.reviewOffer(id, adminId, dto);
  }

  @Get('pending')
  pending(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.playerService.listPending(
      Number(page ?? 1),
      Number(limit ?? 20),
    );
  }

  @Get('transfer/offers/team/:teamId')
  getOffersByTeam(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query('status') status?: 'pending' | 'approved' | 'rejected' | 'cancelled',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.playerService.getOffersByTeam(
      teamId,
      status,
      Number(page ?? 1),
      Number(limit ?? 20),
    );
  }

  @Get('injury')
  getInjury() {
    return this.playerService.getInjury();
  }
}
