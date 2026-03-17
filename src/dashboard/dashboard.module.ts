import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team } from 'src/team/entity/team.entity';
import { Player } from 'src/player/entity/player.entity';
import { Tournament } from 'src/tournament/entity/tournament.entity';
import { User } from 'src/user/entity/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Team, Player, Tournament, User])],
  providers: [DashboardService],
  controllers: [DashboardController],
  exports: [DashboardService]
})
export class DashboardModule {}
