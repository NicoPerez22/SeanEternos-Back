import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Any, QueryRunner, Repository } from 'typeorm';
import { Tournament } from './entity/tournament.entity';
import { Team } from 'src/team/entity/team.entity';
import { Rounds } from './entity/rounds.entity';
import { ApiResponse } from 'shared/models/apiResponse';
import { FormatTournament } from 'src/team/entity/format.entity';
import { Image } from 'src/upload/entity/image.entity';
import { DataSource } from 'typeorm';
import { CreateTournamentDto } from './dto/tournament.dto';
import { ImagesService } from 'shared/services/images/images.service';

type Player = { id: number; valoration: number; position: string };
type Assignment = { teamId: number; playerId: number };

type Slot = { min: number; max: number; label: string };

const QUALITY_SLOTS: Slot[] = [
  { min: 89, max: 91, label: '89_91' },
  { min: 88, max: 88, label: '88' },
  { min: 87, max: 87, label: '87' },
  { min: 85, max: 86, label: '85_86' },
];

// Bandas originales: evitamos agregar más en FASE 2/3
const isOriginalSpecialBand = (ovr: number) =>
  (ovr >= 89 && ovr <= 91) ||
  ovr === 88 ||
  ovr === 87 ||
  (ovr >= 85 && ovr <= 86);

// Grupos de posiciones con mínimos y máximos.
// Mínimos son tus REQUIRED_POS. Máximos los podés ajustar.
type PosGroup = {
  key: string;
  positions: string[];
  min: number; // requerido
  max: number; // limite
};

const POS_GROUPS: PosGroup[] = [
  { key: 'POR', positions: ['POR'], min: 1, max: 2 },

  { key: 'DFC', positions: ['DFC'], min: 3, max: 5 },

  { key: 'DER', positions: ['LD', 'MD', 'ED', 'CAD'], min: 2, max: 4 },
  { key: 'IZQ', positions: ['LI', 'MI', 'EI', 'CAI'], min: 2, max: 4 },

  { key: 'MCD', positions: ['MCD'], min: 2, max: 3 },
  { key: 'MC', positions: ['MC'], min: 3, max: 5 },
  { key: 'MCO', positions: ['MCO'], min: 2, max: 3 },

  { key: 'DC', positions: ['DC'], min: 3, max: 4 },
];

// helper: a qué grupo pertenece una position
const getGroupKey = (pos: string): string | null => {
  for (const g of POS_GROUPS) {
    if (g.positions.includes(pos)) return g.key;
  }
  return null;
};

type PaginationSP = {
  totalItems: number;
  totalPages: number;
  page: number;
  perPage: number;
  formatId: number; // 1 KO, 2 Grupos, 3 Liga
  unitType: 'matchday' | 'round';
  unitValue: number | null; // matchday o round actual
};

type RoundRow = {
  idRound: number;
  tournamentId: number;
  matchday: number | null;
  groupNumber: number | null;
  round: number | null;
  state: number;

  homeTeamId: number;
  homeTeamName: string;
  homeIdLogo: number | null;

  awayTeamId: number;
  awayTeamName: string;
  awayIdLogo: number | null;

  homeGoals: number | null;
  awayGoals: number | null;

  // si tu SP devuelve urls ya armadas, agregalas:
  homeLogoUrl?: string | null;
  awayLogoUrl?: string | null;
};

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
    private readonly dataSource: DataSource,
    private readonly imageService: ImagesService,
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
    const { name, logo, formatId, teamsIds, enableDraft, groups  } = dto;

    const groupsJson =
    formatId === 2 ? JSON.stringify(groups ?? []) : null;

    const result: any = await this.dataSource.query(
      `CALL sp_create_tournament(?, ?, ?, ?, ?, ?)`,
      [
        name,
        logo,
        formatId ?? null,
        JSON.stringify(teamsIds ?? []),
        enableDraft ? 1 : 0,
        groupsJson,
      ],
    );
    const tournamentId = result?.[0]?.[0]?.tournamentId;

    await this.dataSource.query(
      `INSERT INTO draft_status (tournamentId, status, message)
     VALUES (?, 'pending', 'Draft pendiente')`,
      [tournamentId],
    );

    // 3️⃣ Ejecutar draft en BACKGROUND si corresponde
    if (enableDraft === true) {
      await this.executeDraftAsync(tournamentId);
    }

    return {
      message: 'Torneo creado exitosamente',
      tournamentId,
    };
  }

  async removeTournament(tournamentId: number) {
    const qr: QueryRunner = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // Existe torneo?
      const exists = await qr.query(
        `SELECT id FROM tournament WHERE id = ? LIMIT 1`,
        [tournamentId],
      );
      if (!exists?.length) throw new NotFoundException('Torneo no encontrado');

      // 1) match_events (depende de match_reports)
      await qr.query(
        `
        DELETE me
        FROM match_events me
        JOIN match_reports mr ON mr.id = me.reportId
        WHERE mr.tournamentId = ?
        `,
        [tournamentId],
      );

      // 2) match_reports (depende de rounds y torneo)
      await qr.query(`DELETE FROM match_reports WHERE tournamentId = ?`, [
        tournamentId,
      ]);

      // 3) transfers / transfer_offers si guardan tournamentId (si no tienen, sacalo)
      // Si tu transfers tiene tournamentId:
      // await qr.query(`DELETE FROM transfers WHERE tournamentId = ?`, [tournamentId]);

      // Si tu transfer_offers tiene tournamentId:
      // await qr.query(`DELETE FROM transfer_offers WHERE tournamentId = ?`, [tournamentId]);

      // 4) tournament_teams
      await qr.query(`DELETE FROM tournament_teams WHERE tournamentId = ?`, [
        tournamentId,
      ]);

      // 5) rounds (la FK que te está bloqueando)
      await qr.query(`DELETE FROM rounds WHERE tournamentId = ?`, [
        tournamentId,
      ]);

      // 6) tournament_statistics (si existe por tournamentId)
      await qr.query(
        `DELETE FROM tournament_statistics WHERE tournamentId = ?`,
        [tournamentId],
      );

      // 7) Finalmente el torneo
      const del: any = await qr.query(`DELETE FROM tournament WHERE id = ?`, [
        tournamentId,
      ]);

      const affected = Number(del?.affectedRows ?? 0);
      if (!affected)
        throw new BadRequestException('No se pudo eliminar el torneo');

      await qr.commitTransaction();
      return { ok: true, message: 'Torneo eliminado', tournamentId };
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  // -----------------------------------------------------
  // GET ALL TOURNAMENTS
  // -----------------------------------------------------
  async getTournament() {
    const apiResponse = new ApiResponse<any[]>();

    try {
      const torneo = await this.tournamentRepository.find();

      if (!torneo || torneo.length === 0) {
        return {
          ...apiResponse,
          data: null,
          httpCode: HttpStatus.OK,
          message: 'No existen torneos',
        };
      }

      const resp = torneo.map((elem) => {
        return {
          id: elem.id,
          name: elem.name,
          logo: elem.logo,
          isActive: elem.isActive,
          startDate: elem.startDate,
        };
      });

      return {
        ...apiResponse,
        data: resp,
        httpCode: HttpStatus.OK,
        message: '',
      };
    } catch (error) {
      return {
        ...apiResponse,
        data: null,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error al cargar los torneos: ${error.message}`,
      };
    }
  }

  // -----------------------------------------------------
  // GET TOURNAMENT BY ID (con logos y rounds mergeados)
  // -----------------------------------------------------
  async getTournamentById(id: number) {
    const apiResponse = new ApiResponse<any[]>();

    try {
      const tournamentFound = await this.tournamentRepository.findOne({
        where: { id },
        relations: ['format'],
      });

      if (!tournamentFound) {
        return {
          ...apiResponse,
          data: null,
          httpCode: HttpStatus.OK,
          message: 'No existen torneos',
        };
      }

      const resp = {
        httpCode: HttpStatus.OK,
        name: tournamentFound.name,
        logo: tournamentFound.logo,
        format: tournamentFound.format,
        statistics: tournamentFound.statistics,
      };

      return {
        ...apiResponse,
        data: resp,
        httpCode: HttpStatus.OK,
        message: '',
      };
    } catch (error) {
      return {
        ...apiResponse,
        data: null,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error al cargar los torneos: ${error.message}`,
      };
    }
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
  async getRankingLeague(tournamentId: number) {
    const apiResponse = new ApiResponse<any>();

    const rows: any[] = await this.dataSource.query(
      `
    WITH played_home AS (
      SELECT r.home AS teamId, r.homeGoals AS gf, r.awayGoals AS ga
      FROM rounds r
      WHERE r.tournamentId = ?
        AND r.state = 1
        AND r.homeGoals IS NOT NULL
        AND r.awayGoals IS NOT NULL
    ),
    played_away AS (
      SELECT r.away AS teamId, r.awayGoals AS gf, r.homeGoals AS ga
      FROM rounds r
      WHERE r.tournamentId = ?
        AND r.state = 1
        AND r.homeGoals IS NOT NULL
        AND r.awayGoals IS NOT NULL
    ),
    all_rows AS (
      SELECT * FROM played_home
      UNION ALL
      SELECT * FROM played_away
    ),
    stats AS (
      SELECT
        teamId,
        COUNT(*) AS matchesPlayed,
        SUM(CASE WHEN gf > ga THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN gf = ga THEN 1 ELSE 0 END) AS draws,
        SUM(CASE WHEN gf < ga THEN 1 ELSE 0 END) AS losses,
        SUM(gf) AS goalsFor,
        SUM(ga) AS goalsAgainst,
        SUM(gf - ga) AS goalDifference,
        SUM(CASE WHEN gf > ga THEN 3 WHEN gf = ga THEN 1 ELSE 0 END) AS points
      FROM all_rows
      GROUP BY teamId
    )
    SELECT
      t.id AS teamId,
      t.name AS teamName,

      img.secureUrl AS logoUrl,
      img.publicId AS logoPublicId,
      img.originalName AS logoOriginalName,

      COALESCE(s.points, 0) AS points,
      COALESCE(s.goalDifference, 0) AS goalDifference,
      COALESCE(s.goalsFor, 0) AS goalsFor,
      COALESCE(s.goalsAgainst, 0) AS goalsAgainst,
      COALESCE(s.matchesPlayed, 0) AS matchesPlayed,
      COALESCE(s.wins, 0) AS wins,
      COALESCE(s.draws, 0) AS draws,
      COALESCE(s.losses, 0) AS losses
    FROM tournament_teams tt
    JOIN teams t ON t.id = tt.teamsId
    LEFT JOIN image img ON img.id = t.idLogo
    LEFT JOIN stats s ON s.teamId = t.id
    WHERE tt.tournamentId = ?
    ORDER BY points DESC, goalDifference DESC, goalsFor DESC, teamName ASC;
    `,
      [tournamentId, tournamentId, tournamentId],
    );

    const tables = [
      {
        groupNumber: null,
        groupName: 'General',
        rows,
      },
    ];

    return Object.assign(apiResponse, {
      data: { tables },
      httpCode: HttpStatus.OK,
      message: '',
    });
  }

  async getRankingGroups(tournamentId: number) {
    const apiResponse = new ApiResponse<any>();

    const flatRows: any[] = await this.dataSource.query(
      `
    WITH teams_in_group AS (
      SELECT DISTINCT r.groupNumber AS groupNumber, r.home AS teamId
      FROM rounds r
      WHERE r.tournamentId = ? AND r.groupNumber IS NOT NULL

      UNION DISTINCT

      SELECT DISTINCT r.groupNumber AS groupNumber, r.away AS teamId
      FROM rounds r
      WHERE r.tournamentId = ? AND r.groupNumber IS NOT NULL
    ),
    played AS (
      SELECT r.groupNumber AS groupNumber, r.home AS teamId, r.homeGoals AS gf, r.awayGoals AS ga
      FROM rounds r
      WHERE r.tournamentId = ?
        AND r.groupNumber IS NOT NULL
        AND r.state = 1
        AND r.homeGoals IS NOT NULL
        AND r.awayGoals IS NOT NULL

      UNION ALL

      SELECT r.groupNumber AS groupNumber, r.away AS teamId, r.awayGoals AS gf, r.homeGoals AS ga
      FROM rounds r
      WHERE r.tournamentId = ?
        AND r.groupNumber IS NOT NULL
        AND r.state = 1
        AND r.homeGoals IS NOT NULL
        AND r.awayGoals IS NOT NULL
    ),
    stats AS (
      SELECT
        groupNumber,
        teamId,
        COUNT(*) AS matchesPlayed,
        SUM(CASE WHEN gf > ga THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN gf = ga THEN 1 ELSE 0 END) AS draws,
        SUM(CASE WHEN gf < ga THEN 1 ELSE 0 END) AS losses,
        SUM(gf) AS goalsFor,
        SUM(ga) AS goalsAgainst,
        SUM(gf - ga) AS goalDifference,
        SUM(CASE WHEN gf > ga THEN 3 WHEN gf = ga THEN 1 ELSE 0 END) AS points
      FROM played
      GROUP BY groupNumber, teamId
    )
    SELECT
      tig.groupNumber AS groupNumber,
      CONCAT('Grupo ', tig.groupNumber) AS groupName,

      t.id AS teamId,
      t.name AS teamName,

      img.secureUrl AS logoUrl,
      img.publicId AS logoPublicId,
      img.originalName AS logoOriginalName,

      COALESCE(s.points, 0) AS points,
      COALESCE(s.goalDifference, 0) AS goalDifference,
      COALESCE(s.goalsFor, 0) AS goalsFor,
      COALESCE(s.goalsAgainst, 0) AS goalsAgainst,
      COALESCE(s.matchesPlayed, 0) AS matchesPlayed,
      COALESCE(s.wins, 0) AS wins,
      COALESCE(s.draws, 0) AS draws,
      COALESCE(s.losses, 0) AS losses
    FROM teams_in_group tig
    JOIN teams t ON t.id = tig.teamId
    LEFT JOIN image img ON img.id = t.idLogo
    LEFT JOIN stats s ON s.groupNumber = tig.groupNumber AND s.teamId = tig.teamId
    ORDER BY tig.groupNumber ASC, points DESC, goalDifference DESC, goalsFor DESC, teamName ASC;
    `,
      [tournamentId, tournamentId, tournamentId, tournamentId],
    );

    const map = new Map<
      number,
      { groupNumber: number; groupName: string; rows: any[] }
    >();

    for (const r of flatRows) {
      if (!map.has(r.groupNumber)) {
        map.set(r.groupNumber, {
          groupNumber: r.groupNumber,
          groupName: r.groupName,
          rows: [],
        });
      }
      map.get(r.groupNumber)!.rows.push({
        teamId: r.teamId,
        teamName: r.teamName,
        logoUrl: r.logoUrl,
        logoPublicId: r.logoPublicId,
        logoOriginalName: r.logoOriginalName,
        points: r.points,
        goalDifference: r.goalDifference,
        goalsFor: r.goalsFor,
        goalsAgainst: r.goalsAgainst,
        matchesPlayed: r.matchesPlayed,
        wins: r.wins,
        draws: r.draws,
        losses: r.losses,
      });
    }

    const tables = Array.from(map.values()).sort(
      (a, b) => a.groupNumber - b.groupNumber,
    );

    return Object.assign(apiResponse, {
      data: { tables },
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

  async getRoundsPaginated(tournamentId: number, page: number) {
    const apiResponse = new ApiResponse<any>();

    try {
      const result = await this.dataSource.query(
        `CALL sp_get_tournament_rounds_by_matchday_paginated(?, ?)`,
        [tournamentId, page],
      );

      const pagination = result?.[0]?.[0] ?? null;
      const rows = (result?.[1] ?? []).filter((r) => r?.idRound != null);

      if (!pagination) {
        return {
          ...apiResponse,
          httpCode: HttpStatus.OK,
          message: 'No hay rounds para este torneo',
          data: {
            pagination: null,
            formatId: null,
            unitType: null,
            unitValue: null,
            groups: [],
          },
        };
      }

      const resolveLogoUrl = this.createLogoUrlResolver();

      // Enriquecemos cada partido con URLs
      const roundsWithLogoUrl = await Promise.all(
        rows.map(async (r) => ({
          ...r,
          homeLogoUrl:
            r.homeLogoUrl ?? (await resolveLogoUrl(r.homeIdLogo)) ?? null,
          awayLogoUrl:
            r.awayLogoUrl ?? (await resolveLogoUrl(r.awayIdLogo)) ?? null,
        })),
      );

      // ✅ SIEMPRE devolvemos groups
      let groups: Array<{ groupNumber: number | null; rounds: any[] }> = [];

      if (pagination.formatId === 2) {
        // Formato GRUPOS => separar por groupNumber
        const groupsMap = new Map<number, any[]>();

        for (const r of roundsWithLogoUrl) {
          const groupNumber = r.groupNumber ?? 0;
          if (!groupsMap.has(groupNumber)) groupsMap.set(groupNumber, []);
          groupsMap.get(groupNumber)!.push(r);
        }

        groups = [...groupsMap.entries()]
          .sort(([a], [b]) => a - b)
          .map(([groupNumber, rounds]) => ({ groupNumber, rounds }));
      } else {
        // Liga / KO => un solo grupo “General”
        groups = [{ groupNumber: null, rounds: roundsWithLogoUrl }];
      }

      return {
        ...apiResponse,
        httpCode: HttpStatus.OK,
        message: '',
        data: {
          pagination,
          formatId: pagination.formatId,
          unitType: pagination.unitType,
          unitValue: pagination.unitValue,
          groups, // ✅ siempre presente
        },
      };
    } catch (error: any) {
      return {
        ...apiResponse,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error al cargar rounds: ${error.message}`,
        data: null,
      };
    }
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

  async getDraftStatus(tournamentId: number) {
    const result = await this.dataSource.query(
      `SELECT * FROM draft_status WHERE tournamentId=?`,
      [tournamentId],
    );

    return result[0] ?? { status: 'pending' };
  }

  async executeDraftAsync(tournamentId: number) {
    const runner = this.dataSource.createQueryRunner();

    await runner.connect();

    const lockName = `draft:${tournamentId}`;
    try {
      // ---- Lock global por torneo (evita ejecuciones simultáneas)
      const lock = await runner.query('SELECT GET_LOCK(?, 2) AS gotLock', [
        lockName,
      ]);
      const gotLock = lock?.[0]?.gotLock ?? lock?.[0]?.gotlock;
      if (gotLock !== 1) {
        throw new Error(
          'Draft en ejecución para este torneo (lock no disponible).',
        );
      }

      await runner.startTransaction();

      // 1) Equipos del torneo
      const teamRows: Array<{ teamId: number }> = await runner.query(
        `SELECT teamsId AS teamId
         FROM tournament_teams
         WHERE tournamentId = ?
         ORDER BY teamsId ASC`,
        [tournamentId],
      );
      const teamIds = teamRows.map((t) => Number(t.teamId));
      if (teamIds.length === 0) throw new Error('No hay equipos en el torneo.');

      // 2) Limpiar logs (opcional)
      await runner.query('DELETE FROM draft_log WHERE tournamentId = ?', [
        tournamentId,
      ]);

      // 3) Liberar jugadores ya asignados a esos equipos (replica tu SP)
      await runner.query(
        `UPDATE players
         SET idTeam = NULL
         WHERE idTeam IN (
           SELECT teamsId
           FROM tournament_teams
           WHERE tournamentId = ?
         )`,
        [tournamentId],
      );

      // 4) Pool de jugadores (solo columnas necesarias)
      const playersRows: Array<Player> = await runner.query(
        `SELECT id, valoration, position
         FROM players
         WHERE isHabilitado = 1
           AND valoration BETWEEN 77 AND 94
           AND idTeam IS NULL`,
      );
      const players: Player[] = playersRows.map((p) => ({
        id: Number(p.id),
        valoration: Number(p.valoration),
        position: String(p.position),
      }));

      // 5) Draft en memoria
      const assignments = this.buildDraft(teamIds, players);

      // 6) Persistir en batch (UPDATE CASE en chunks)
      await this.persistAssignments(runner, assignments);

      // 7) Log en batch
      await this.insertDraftLog(runner, tournamentId, assignments);

      await runner.commitTransaction();

      // Respuesta simple
      return {
        tournamentId,
        teams: teamIds.length,
        assigned: assignments.length,
      };
    } catch (err) {
      try {
        await runner.rollbackTransaction();
      } catch {}
      throw err;
    } finally {
      // liberar lock aunque haya error
      try {
        await runner.query('SELECT RELEASE_LOCK(?)', [lockName]);
      } catch {}
      await runner.release();
    }
  }

  async runDraft(tournamentId: number) {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();

    const lockName = `draft:${tournamentId}`;

    try {
      // Lock por torneo
      const lock = await runner.query('SELECT GET_LOCK(?, 2) AS gotLock', [
        lockName,
      ]);
      const gotLock = lock?.[0]?.gotLock ?? lock?.[0]?.gotlock;
      if (gotLock !== 1) {
        throw new Error(
          'Draft en ejecución para este torneo (lock no disponible).',
        );
      }

      await runner.startTransaction();

      // Equipos del torneo
      const teamRows: Array<{ teamId: number }> = await runner.query(
        `SELECT teamsId AS teamId
         FROM tournament_teams
         WHERE tournamentId = ?
         ORDER BY teamsId ASC`,
        [tournamentId],
      );
      const teamIds = teamRows.map((t) => Number(t.teamId));
      if (teamIds.length === 0) throw new Error('No hay equipos en el torneo.');

      // Limpiar logs (opcional)
      await runner.query('DELETE FROM draft_log WHERE tournamentId = ?', [
        tournamentId,
      ]);

      // Liberar jugadores de esos equipos (como tu SP)
      await runner.query(
        `UPDATE players
         SET idTeam = NULL
         WHERE idTeam IN (
           SELECT teamsId FROM tournament_teams WHERE tournamentId = ?
         )`,
        [tournamentId],
      );

      // Pool mínimo
      const rows: Array<any> = await runner.query(
        `SELECT id, valoration, position
         FROM players
         WHERE isHabilitado = 1
           AND valoration BETWEEN 77 AND 94
           AND idTeam IS NULL`,
      );

      const players: Player[] = rows.map((r) => ({
        id: Number(r.id),
        valoration: Number(r.valoration),
        position: String(r.position),
      }));

      // Chequeo mínimo: cantidad total
      const requiredTotal = teamIds.length * 22;
      if (players.length < requiredTotal) {
        throw new Error(
          `No hay suficientes jugadores libres para ${teamIds.length} equipos: ` +
            `se requieren ${requiredTotal}, hay ${players.length}.`,
        );
      }

      // Draft en memoria
      const assignments = this.buildDraft(teamIds, players);

      // Persistir batch
      await this.persistAssignments(runner, assignments);

      // Log batch
      await this.insertDraftLog(runner, tournamentId, assignments);

      await runner.commitTransaction();

      return {
        tournamentId,
        teams: teamIds.length,
        assigned: assignments.length,
      };
    } catch (err) {
      try {
        await runner.rollbackTransaction();
      } catch {}
      throw err;
    } finally {
      try {
        await runner.query('SELECT RELEASE_LOCK(?)', [lockName]);
      } catch {}
      await runner.release();
    }
  }

  async getTeamsByRound(roundId: number) {
    try {
      const rows = await this.dataSource.query(
        `
        SELECT
          r.id        AS roundId,
          r.home      AS homeId,
          th.name     AS homeName,
          r.away      AS awayId,
          ta.name     AS awayName
        FROM rounds r
        INNER JOIN teams th ON th.id = r.home
        INNER JOIN teams ta ON ta.id = r.away
        WHERE r.id = ?
        `,
        [roundId],
      );

      const row = rows?.[0];

      if (!row) {
        throw new NotFoundException(`No se encontró el round con id=${roundId}`);
      }

      return {
        httpCode: 200,
        message: 'Equipos obtenidos correctamente',
        data: {
          roundId: row.roundId,
          teams: [
            { id: row.homeId, name: row.homeName, side: 'home' },
            { id: row.awayId, name: row.awayName, side: 'away' },
          ],
        },
      };
    } catch (error) {
      if (error?.status === 404) throw error;

      throw new InternalServerErrorException(
        `Error al obtener equipos del round: ${error.sqlMessage || error.message}`,
      );
    }
  }

  // =========================================================
  // Draft algorithm (slots de calidad + posiciones + relleno)
  // =========================================================
  private buildDraft(teamIds: number[], players: Player[]): Assignment[] {
    const all = [...players].sort((a, b) => b.valoration - a.valoration);

    const available = new Set<number>(all.map((p) => p.id));
    const byId = new Map<number, Player>();
    for (const p of all) byId.set(p.id, p);

    const rosterByTeam = new Map<number, number[]>();
    const groupCountByTeam = new Map<number, Map<string, number>>();

    for (const teamId of teamIds) {
      rosterByTeam.set(teamId, []);
      const m = new Map<string, number>();
      for (const g of POS_GROUPS) m.set(g.key, 0);
      groupCountByTeam.set(teamId, m);
    }

    const assignments: Assignment[] = [];

    const getGroupCount = (teamId: number, groupKey: string) =>
      groupCountByTeam.get(teamId)!.get(groupKey) ?? 0;

    const canAddByMax = (teamId: number, p: Player) => {
      const gk = getGroupKey(p.position);
      if (!gk) return true; // si aparece una posición rara, no bloqueamos (o podés bloquear)
      const g = POS_GROUPS.find((x) => x.key === gk)!;
      return getGroupCount(teamId, gk) < g.max;
    };

    const addPlayerToTeam = (teamId: number, p: Player): boolean => {
      if (!available.has(p.id)) return false;

      const roster = rosterByTeam.get(teamId)!;
      if (roster.length >= 22) return false;

      if (!canAddByMax(teamId, p)) return false;

      available.delete(p.id);
      roster.push(p.id);
      assignments.push({ teamId, playerId: p.id });

      const gk = getGroupKey(p.position);
      if (gk) {
        groupCountByTeam.set(
          teamId,
          new Map(groupCountByTeam.get(teamId)!).set(
            gk,
            getGroupCount(teamId, gk) + 1,
          ),
        );
      }

      return true;
    };

    const pickBest = (predicate: (p: Player) => boolean): Player | null => {
      for (const p of all) {
        if (!available.has(p.id)) continue;
        if (!predicate(p)) continue;
        return p;
      }
      return null;
    };

    const snakeOrder = (ids: number[], roundIndex: number) =>
      roundIndex % 2 === 0 ? ids : [...ids].reverse();

    // slot picker: ideal -> degradación, respetando < slot anterior
    const pickForSlot = (
      prevOVR: number | null,
      slot: Slot,
      teamId: number,
    ): Player | null => {
      const maxAllowed =
        prevOVR === null ? Number.POSITIVE_INFINITY : prevOVR - 1;

      // 1) ideal rango
      for (const p of all) {
        if (!available.has(p.id)) continue;
        if (p.valoration > maxAllowed) continue;
        if (!canAddByMax(teamId, p)) continue;
        if (p.valoration >= slot.min && p.valoration <= slot.max) return p;
      }

      // 2) degradar: mejor por debajo del min del slot
      for (const p of all) {
        if (!available.has(p.id)) continue;
        if (p.valoration > maxAllowed) continue;
        if (!canAddByMax(teamId, p)) continue;
        if (p.valoration < slot.min) return p;
      }

      return null;
    };

    // =========================================================
    // FASE 1) Slots de calidad (4 por equipo), con degradación y orden
    // =========================================================
    for (let si = 0; si < QUALITY_SLOTS.length; si++) {
      const slot = QUALITY_SLOTS[si];
      const order = snakeOrder(teamIds, si);

      for (const teamId of order) {
        const roster = rosterByTeam.get(teamId)!;
        const prevId = roster.length ? roster[roster.length - 1] : null;
        const prevOVR = prevId ? (byId.get(prevId)?.valoration ?? null) : null;

        const picked = pickForSlot(prevOVR, slot, teamId);
        if (!picked) {
          throw new Error(
            `No hay jugadores para slot ${slot.label} (con degradación) en equipo ${teamId}.`,
          );
        }

        const ok = addPlayerToTeam(teamId, picked);
        if (!ok)
          throw new Error(
            `No se pudo asignar slot ${slot.label} al equipo ${teamId}.`,
          );
      }
    }

    // =========================================================
    // FASE 2) Completar mínimos por grupo (posiciones obligatorias)
    //         sin usar bandas especiales originales (para no meter 2 cracks)
    // =========================================================
    for (const teamId of teamIds) {
      for (const g of POS_GROUPS) {
        while (getGroupCount(teamId, g.key) < g.min) {
          const p = pickBest((pl) => {
            if (!available.has(pl.id)) return false;
            if (isOriginalSpecialBand(pl.valoration)) return false;
            const gk = getGroupKey(pl.position);
            if (gk !== g.key) return false;
            return canAddByMax(teamId, pl);
          });

          if (!p) {
            throw new Error(
              `No hay jugadores suficientes para completar el mínimo del grupo ${g.key} en equipo ${teamId}.`,
            );
          }

          addPlayerToTeam(teamId, p);
        }
      }
    }

    // =========================================================
    // FASE 3) Relleno hasta 22:
    //         - sin bandas especiales originales
    //         - sin romper máximos
    //         - prioriza el grupo más “vacío” (mejor balance)
    // =========================================================
    for (const teamId of teamIds) {
      while (rosterByTeam.get(teamId)!.length < 22) {
        // elegir el grupo con más “margen” (max - count) y/o que esté más bajo
        const groupsOrdered = [...POS_GROUPS].sort((a, b) => {
          const ma = a.max - getGroupCount(teamId, a.key);
          const mb = b.max - getGroupCount(teamId, b.key);
          // primero el que tiene más margen (para no trabarnos al final)
          if (mb !== ma) return mb - ma;
          // si empatan, el que tenga menos count
          return getGroupCount(teamId, a.key) - getGroupCount(teamId, b.key);
        });

        let picked: Player | null = null;

        // intentamos llenar con el mejor del grupo “más conveniente”
        for (const g of groupsOrdered) {
          picked = pickBest((pl) => {
            if (isOriginalSpecialBand(pl.valoration)) return false;
            const gk = getGroupKey(pl.position);
            if (gk !== g.key) return false;
            return canAddByMax(teamId, pl);
          });
          if (picked) break;
        }

        // fallback: cualquier jugador (no special) que no rompa max (por si quedan posiciones raras)
        if (!picked) {
          picked = pickBest(
            (pl) =>
              !isOriginalSpecialBand(pl.valoration) && canAddByMax(teamId, pl),
          );
        }

        if (!picked) {
          throw new Error(
            `No se puede completar 22 jugadores en equipo ${teamId} sin romper máximos de posición.`,
          );
        }

        addPlayerToTeam(teamId, picked);
      }
    }

    // =========================================================
    // Validaciones finales
    // =========================================================
    for (const teamId of teamIds) {
      const roster = rosterByTeam.get(teamId)!;
      if (roster.length !== 22)
        throw new Error(
          `Equipo ${teamId} quedó con ${roster.length} (debe ser 22).`,
        );

      // validar slots mayor->menor (los 4 primeros picks)
      const slotOVR = roster
        .slice(0, 4)
        .map((pid) => byId.get(pid)!.valoration);
      for (let i = 1; i < slotOVR.length; i++) {
        if (!(slotOVR[i] < slotOVR[i - 1])) {
          throw new Error(
            `Equipo ${teamId} no cumple orden slots mayor->menor: ${slotOVR.join(', ')}`,
          );
        }
      }

      // validar mínimos
      for (const g of POS_GROUPS) {
        const c = getGroupCount(teamId, g.key);
        if (c < g.min)
          throw new Error(
            `Equipo ${teamId} no cumple mínimo de ${g.key} (tiene ${c}, min ${g.min}).`,
          );
        if (c > g.max)
          throw new Error(
            `Equipo ${teamId} excede máximo de ${g.key} (tiene ${c}, max ${g.max}).`,
          );
      }
    }

    const uniq = new Set(assignments.map((a) => a.playerId));
    if (uniq.size !== assignments.length)
      throw new Error('Se detectaron jugadores repetidos.');

    return assignments;
  }

  // =========================================================
  // Persistencia: UPDATE masivo en chunks
  // =========================================================
  private async persistAssignments(
    runner: QueryRunner,
    assignments: Assignment[],
  ) {
    if (!assignments.length) return;

    const chunkSize = 700;

    for (let i = 0; i < assignments.length; i += chunkSize) {
      const chunk = assignments.slice(i, i + chunkSize);

      const ids = chunk.map((a) => a.playerId);
      const cases = chunk
        .map((a) => `WHEN ${a.playerId} THEN ${a.teamId}`)
        .join(' ');

      const sql = `
        UPDATE players
        SET
          idTeam = CASE id ${cases} END,
          isTransfer = 0
        WHERE id IN (${ids.join(',')})
      `;

      await runner.query(sql);
    }
  }

  // =========================================================
  // Logs: INSERT batch
  // =========================================================
  private async insertDraftLog(
    runner: QueryRunner,
    tournamentId: number,
    assignments: Assignment[],
  ) {
    if (!assignments.length) return;

    const chunkSize = 800;

    for (let i = 0; i < assignments.length; i += chunkSize) {
      const chunk = assignments.slice(i, i + chunkSize);

      const placeholders: string[] = [];
      const values: any[] = [];

      for (const a of chunk) {
        placeholders.push("(?, ?, ?, 'ASSIGN', ?)");
        values.push(
          tournamentId,
          a.teamId,
          a.playerId,
          `Jugador ${a.playerId} asignado al equipo ${a.teamId}`,
        );
      }

      await runner.query(
        `INSERT INTO draft_log (tournamentId, teamId, playerId, action, message)
         VALUES ${placeholders.join(',')}`,
        values,
      );
    }
  }

  private createLogoUrlResolver() {
    const cache = new Map<number, string | null>();

    return async (
      idLogo: number | null | undefined,
    ): Promise<string | null> => {
      if (idLogo === null || idLogo === undefined) return null;

      const key = Number(idLogo);
      if (!Number.isFinite(key) || key <= 0) return null;

      if (cache.has(key)) return cache.get(key)!;

      const img = await this.imageService.getImage(key);
      const url = img?.secureUrl ?? null; // 👈 ajustá según tu ImageService
      cache.set(key, url);
      return url;
    };
  }

  async previewMatchReport(dto: {
    roundId: number;
    tournamentId: number;
    homeGoals: number;
    awayGoals: number;
    events: any[];
  }) {
    const { roundId, tournamentId, homeGoals, awayGoals, events } = dto;
  
    const result: any = await this.dataSource.query(
      `CALL sp_preview_match_report(?, ?, ?, ?, ?)`,
      [
        roundId,
        tournamentId,
        homeGoals ?? 0,
        awayGoals ?? 0,
        JSON.stringify(events ?? []),
      ],
    );
  
    const row = result?.[0]?.[0];
    const raw = row?.previewReportJson ?? null;
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  
    return {
      message: 'Preview generado correctamente',
      data,
    };
  }

  async createDraft(dto: any) {
    const result: any = await this.dataSource.query(
      `CALL sp_create_match_report_draft(?, ?, ?, ?, ?, ?)`,
      [
        dto.roundId,
        dto.tournamentId,
        dto.homeGoals ?? 0,
        dto.awayGoals ?? 0,
        JSON.stringify(dto.events ?? []),
        dto.createdByUserId ?? null,
      ],
    );
  
    const draftId = result?.[0]?.[0]?.draftId;
  
    return { message: 'Draft creado', draftId };
  }
  
  async listDrafts(filters: { status: string | null; tournamentId: number | null }) {
    const result: any = await this.dataSource.query(
      `CALL sp_list_match_report_drafts(?, ?)`,
      [filters.status, filters.tournamentId],
    );
  
    return { message: 'Drafts obtenidos', data: result?.[0] ?? [] };
  }
  
  async getDraftDetail(draftId: number) {
    const result: any = await this.dataSource.query(
      `CALL sp_get_match_report_draft_detail(?)`,
      [draftId],
    );
  
    // 2 resultsets: header y events
    const header = result?.[0]?.[0] ?? null;
    const events = result?.[1] ?? [];
  
    if (!header) throw new NotFoundException(`Draft no encontrado id=${draftId}`);
  
    return { message: 'Detalle draft', data: { ...header, events } };
  }
  
  async reviewDraft(draftId: number, dto: { adminId: number; action: string; reviewNote?: string }) {
    const result: any = await this.dataSource.query(
      `CALL sp_review_match_report_draft(?, ?, ?, ?)`,
      [draftId, dto.adminId, dto.action, dto.reviewNote ?? null],
    );
  
    const row = result?.[0]?.[0];
    return { message: 'Draft revisado', data: row };
  }
}
