import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
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
import { Image } from 'src/upload/entity/image.entity';
import { TeamService } from 'src/team/team.service';
import { DataSource } from 'typeorm';
import { CreateTournamentDto } from './dto/tournament.dto';

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

    @InjectRepository(Image)
    private readonly imageRepository: Repository<Image>,

    private readonly teamService: TeamService,
    private readonly dataSource: DataSource,
  ) {}

  // -----------------------------------------------------
  // GET FORMATS
  // -----------------------------------------------------
  async getFormats() {
    const apiResponse = new ApiResponse<any[]>();

    try {
      const formats = await this.dataSource.getRepository('formats').find();

      if (!formats.length) {
        return {
          ...apiResponse,
          httpCode: HttpStatus.OK,
          message: 'No existen formatos de torneo',
        };
      }

      return {
        ...apiResponse,
        httpCode: HttpStatus.OK,
        message: 'No existen formatos de torneo',
        data: formats,
      };
    } catch (error) {
      return {
        ...apiResponse,
        httpCode: HttpStatus.NOT_FOUND,
        message: 'No existen formatos de torneo',
      };
    }
  }

  // -----------------------------------------------------
  // CREATE TOURNAMENT (SP)
  // -----------------------------------------------------
  async createTournament(dto: CreateTournamentDto) {
    const { name, logo, formatId, teamsIds, rounds } = dto;

    const result: any = await this.dataSource.query(
      `CALL sp_create_tournament(?, ?, ?, ?, ?)`,
      [
        name,
        logo,
        formatId ?? null,
        JSON.stringify(teamsIds),
        JSON.stringify(rounds),
      ],
    );

    const tournamentId = result?.[0]?.[0]?.tournamentId;

    return {
      message: 'Torneo creado exitosamente',
      tournamentId,
    };
  }

  // -----------------------------------------------------
  // GET ALL TOURNAMENTS
  // -----------------------------------------------------
  async getTournament() {
    const apiResponse = new ApiResponse<any[]>();

    try {
      const torneo = await this.tournamentRepository.find();

      if (!torneo || torneo.length === 0) {
        return Object.assign(apiResponse, {
          data: null,
          httpCode: HttpStatus.OK,
          message: 'No existen torneos',
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
        message: `Error al cargar los torneos: ${error.message}`,
      });
    }
  }

  // -----------------------------------------------------
  // GET TOURNAMENT BY ID (con logos y rounds mergeados)
  // -----------------------------------------------------
  async getTournamentById(id: number) {
    const tournamentFound = await this.tournamentRepository.findOne({
      where: { id },
      relations: ['format'],
    });

    if (!tournamentFound) {
      throw new HttpException('El torneo no existe', HttpStatus.NOT_FOUND);
    }

    return {
      httpCode: HttpStatus.OK,
      name: tournamentFound.name,
      logo: tournamentFound.logo,
      format: tournamentFound.format,
      statistics: tournamentFound.statistics,
    };
  }

  // -----------------------------------------------------
  // STANDINGS (team_statistics view)
  // -----------------------------------------------------
  async getStandings(tournamentId: number) {
    return this.dataSource.query(
      `
      SELECT *
      FROM team_statistics
      WHERE tournamentId = ?
      ORDER BY points DESC, goalDifference DESC, goalsFor DESC;
      `,
      [tournamentId],
    );
  }

  // -----------------------------------------------------
  // RANKING (same view but lighter)
  // -----------------------------------------------------
  async getRanking(tournamentId: number) {
    const apiResponse = new ApiResponse<any[]>();

    const result: any = await this.dataSource.query(
      `
      SELECT 
          t.id AS teamId,
          t.name AS teamName,

          COALESCE(ts.points, 0) AS points,
          COALESCE(ts.goalDifference, 0) AS goalDifference,
          COALESCE(ts.goalsFor, 0) AS goalsFor,
          COALESCE(ts.goalsAgainst, 0) AS goalsAgainst,
          COALESCE(ts.matchesPlayed, 0) AS matchesPlayed,
          COALESCE(ts.wins, 0) AS wins,
          COALESCE(ts.draws, 0) AS draws,
          COALESCE(ts.losses, 0) AS losses

      FROM tournament_teams tt
      JOIN teams t ON t.id = tt.teamsId

      LEFT JOIN team_statistics ts 
          ON ts.teamId = t.id 
          AND ts.tournamentId = ?

      WHERE tt.tournamentId = ?
      ORDER BY points DESC, goalDifference DESC;
    `,
      [tournamentId, tournamentId],
    );

    return Object.assign(apiResponse, {
      data: result,
      httpCode: HttpStatus.OK,
      message: '',
    });
  }

  // -----------------------------------------------------
  // GLOBAL TOURNAMENT STATS (tournament_statistics view)
  // -----------------------------------------------------
  async getTournamentStats(tournamentId: number) {
    const stats = await this.dataSource.query(
      `
      SELECT *
      FROM tournament_statistics
      WHERE tournamentId = ?;
      `,
      [tournamentId],
    );

    return stats[0] || null;
  }

  // -----------------------------------------------------
  // HIGHLIGHTS (best attack, defense, leader)
  // -----------------------------------------------------
  async getHighlights(tournamentId: number) {
    const result = await this.dataSource.query(
      `
      SELECT 
        bestAttackTeam,
        bestDefenseTeam,
        leaderTeam
      FROM tournament_statistics
      WHERE tournamentId = ?;
      `,
      [tournamentId],
    );

    return result[0] || null;
  }

  // -----------------------------------------------------
  // TEAM STATS FOR SPECIFIC TOURNAMENT
  // -----------------------------------------------------
  async getTeamStats(teamId: number, tournamentId: number) {
    const result = await this.dataSource.query(
      `
      SELECT *
      FROM team_statistics
      WHERE teamId = ? AND tournamentId = ?;
      `,
      [teamId, tournamentId],
    );

    return result[0] || null;
  }

  async _getImage(idLogo) {
    return this.imageRepository.findOne({ where: { id: idLogo } });
  }

  generateMatchesFormatLeague(teams: Array<any>) {
    const workingTeams = [...teams];

    // Si es impar → agregar BYE
    if (workingTeams.length % 2 !== 0) {
      workingTeams.push({ id: null });
    }

    const numTeams = workingTeams.length;
    const numRounds = numTeams - 1;
    const matchesPerRound = numTeams / 2;

    const jornada: any = [];

    for (let round = 0; round < numRounds; round++) {
      for (let i = 0; i < matchesPerRound; i++) {
        const home = workingTeams[i];
        const away = workingTeams[numTeams - 1 - i];

        // Saltar BYE
        if (!home.id || !away.id) continue;

        jornada.push({
          round: round + 1,
          home: home.id,
          away: away.id,
          state: 0,
          teamWin: null,
          teamLose: null,
        });
      }

      // Rotación Round Robin
      workingTeams.splice(1, 0, workingTeams.pop());
    }

    return {
      jornada,
      totalRounds: numRounds,
      totalMatches: jornada.length,
    };
  }

  async getRoundsPaginated(tournamentId: number, page: number, limit: number) {
    const result = await this.dataSource.query(
      `CALL sp_get_tournament_rounds_paginated_pro(?, ?, ?)`,
      [tournamentId, page, limit],
    );

    return {
      pagination: result[0][0],
      rounds: result[1],
    };
  }

  async saveMatchReport(dto: any) {
    const { roundId, tournamentId, homeGoals, awayGoals, events } = dto;

    try {
      const result = await this.dataSource.query(
        `CALL sp_save_match_report(?, ?, ?, ?, ?)`,
        [roundId, tournamentId, homeGoals, awayGoals, JSON.stringify(events)],
      );

      const reportId = result?.[0]?.[0]?.reportId;

      return {
        httpCode: 200,
        message: 'Reporte guardado correctamente',
        reportId,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Error al guardar el reporte: ${error.sqlMessage || error.message}`,
      );
    }
  }
}
