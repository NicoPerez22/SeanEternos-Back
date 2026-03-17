import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiResponse } from 'shared/models/apiResponse';
import { ResumeDTO } from './entity/resumeDTO';
import { Team } from 'src/team/entity/team.entity';
import { Player } from 'src/player/entity/player.entity';
import { Tournament } from 'src/tournament/entity/tournament.entity';
import { User } from 'src/user/entity/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class DashboardService {
    constructor(
        @InjectRepository(Team) private readonly teamRepository: Repository<Team>,
        @InjectRepository(Player) private readonly playerRepository: Repository<Player>,
        @InjectRepository(Tournament) private readonly tournamentRepository: Repository<Tournament>,
        @InjectRepository(User) private readonly userRepository: Repository<User>,
    ) {}

    async getResume() {
        const apiResponse = new ApiResponse<ResumeDTO>();
    
        try {
          const totalTeams = await this.teamRepository.count();
          const totalPlayers = await this.playerRepository.count();
          const totalTournaments = await this.tournamentRepository.count();
          const totalUsers = await this.userRepository.count();
    
          const resume = {
            totalTeams,
            totalPlayers,
            totalTournaments,
            totalUsers,
          };
    
          return {
            ...apiResponse,
            data: resume,
            httpCode: HttpStatus.OK,
            message: '',
          };
        } catch (error) {
          return {
            ...apiResponse,
            data: null,
            httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: `Error al crear el equipo: ${error.message}`,
          };
        }
      }
}
