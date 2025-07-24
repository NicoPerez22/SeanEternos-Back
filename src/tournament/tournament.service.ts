import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tournament } from './entity/tournament.entity';
import { MatchesInterface } from './matches.interface';
import { Team } from 'src/team/entity/team.entity';
import { Rounds } from './entity/rounds.entity';
import { ApiResponse } from 'shared/models/apiResponse';
import { FormatTournament } from 'src/team/entity/format.entity';

@Injectable()
export class TournamentService {
  private teams: string[] = [];
  private latestId: number = 0;

  constructor(
    @InjectRepository(Tournament)
    private readonly tournamentRepository: Repository<Tournament>,

    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,

    @InjectRepository(Rounds)
    private readonly roundsRepository: Repository<Rounds>,

    @InjectRepository(FormatTournament)
    private readonly formatsRepository: Repository<FormatTournament>,
  ) {}

  async getFormats() {
    const apiResponse = new ApiResponse<any[]>();

    try {
      const formats = await this.formatsRepository.find();

      if (!formats || formats.length === 0) {
        return Object.assign(apiResponse, {
          data: null,
          httpCode: HttpStatus.OK,
          message: 'No existen formatos de torneo',
        });
      }

      return Object.assign(apiResponse, {
        data: formats,
        httpCode: HttpStatus.OK,
        message: '',
      });
    } catch (error) {
      return Object.assign(apiResponse, {
        data: null,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error al cargar los equipos: ${error.message}`,
      });
    }
  }

  async createTournament(tournament: any) {
    const { name, logo, teamsIds, formatId } = tournament;

    const tournamentFound = await this.tournamentRepository.findOne({
      where: { name },
    });

    if (tournamentFound) {
      throw new HttpException('El torneo ya existe', HttpStatus.CONFLICT);
    }

    const equipos = await this.validateTeamsExist(teamsIds);
    let format;
    if (formatId) {
      const foundFormat = await this.formatsRepository.findOne({
        where: { id: formatId },
      });
      if (foundFormat) {
        format = foundFormat;
      }
    }

    // Genera las fechas/rondas
    const rounds = await this.drawTournament(equipos);

    // Estadísticas iniciales (puedes personalizar esto)
    const statistics = {
      totalTeams: equipos.length,
      totalRounds: rounds.length,
      // Puedes agregar más estadísticas aquí
    };

    const newTournament = this.tournamentRepository.create({
      name,
      logo,
      teams: equipos,
      rounds,
      format,
      statistics,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return await this.tournamentRepository.save(newTournament);
  }

  async getTournament() {
    const apiResponse = new ApiResponse<any[]>();

    try {
      const torneo = await this.tournamentRepository.find();

      if (!torneo || torneo.length === 0) {
        return Object.assign(apiResponse, {
          data: null,
          httpCode: HttpStatus.OK,
          message: 'No existen formatos de torneo',
        });
      }

      return Object.assign(apiResponse, {
        data: torneo,
        httpCode: HttpStatus.OK,
        message: '',
      });
    } catch (error) {
      return Object.assign(apiResponse, {
        data: null,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error al cargar los equipos: ${error.message}`,
      });
    }
  }

  async getTournamentById(id: number) {
    const tournamentFound = await this.tournamentRepository.findOne({
      where: { id },
      relations: ['teams', 'rounds', 'format'],
    });

    if (!tournamentFound) {
      throw new HttpException('El torneo no existe', HttpStatus.NOT_FOUND);
    }

    const mergedRounds = this.mergeRoundsWithTeams(
      tournamentFound.rounds,
      tournamentFound.teams,
    );

    return {
      httpCode: HttpStatus.OK,
      name: tournamentFound.name,
      logo: tournamentFound.logo,
      format: tournamentFound.format,
      teams: tournamentFound.teams,
      rounds: mergedRounds,
      statistics: tournamentFound.statistics,
    };
  }

  generateMatchesFormatLeague(teams: Array<any>): any {
    this.teams = teams;
    const totalRounds = this.teams.length - 1;
    const roundMatches: Array<any> = [];

    for (let round = 0; round < totalRounds; round++) {
      for (let i = 0; i < this.teams.length / 2; i++) {
        const home = this.teams[i];
        const away = this.teams[this.teams.length - 1 - i];
        const match =
          round % 2 === 0 ? { home, away } : { home: away, away: home };

        const newMatch = new MatchesInterface();
        Object.assign(newMatch, match);
        roundMatches.push(newMatch);
      }

      this.rotateTeams();
    }

    return {
      jornada: roundMatches,
      fechaNumero: this.incrementId(),
    };
  }

  async drawTournament(teams: Team[]) {
    const rounds: Array<any> = [];
    this.shuffleArray(teams);

    let roundNumber = 1;
    while (teams.length > 1) {
      const nextRoundTeams = [];

      for (let i = 0; i < teams.length; i += 2) {
        const round = this.roundsRepository.create({
          round: roundNumber,
          home: teams[i].id,
          away: teams[i + 1].id,
        });

        const savedRound = await this.roundsRepository.save(round);
        rounds.push(savedRound);
      }

      teams = nextRoundTeams;
      roundNumber++;
    }

    return rounds;
  }

  private async validateTeamsExist(teamsIds: number[]): Promise<Team[]> {
    const equipos = await this.teamRepository.findByIds(teamsIds);

    if (equipos.length !== teamsIds.length) {
      throw new NotFoundException('Some equipos not found');
    }

    return equipos;
  }

  private mergeRoundsWithTeams(rounds: Rounds[], teams: Team[]) {
    return rounds.map((round) => {
      const homeTeam = teams.find((team) => team.id === round.home);
      const awayTeam = teams.find((team) => team.id === round.away);

      return {
        idHome: homeTeam?.id,
        home: homeTeam?.name,
        idAway: awayTeam?.id,
        away: awayTeam?.name,
      };
    });
  }

  private rotateTeams() {
    const lastTeam = this.teams.pop();
    if (lastTeam) {
      this.teams.splice(1, 0, lastTeam);
    }
  }

  private incrementId(): number {
    return ++this.latestId;
  }

  private shuffleArray(array: any[]) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
