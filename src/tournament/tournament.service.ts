import {
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
    const { name, logo, formatId, teamsIds, enableDraft } = dto;

    const result: any = await this.dataSource.query(
      `CALL sp_create_tournament(?, ?, ?, ?, ?)`,
      [
        name,
        logo,
        formatId ?? null,
        JSON.stringify(teamsIds),
        enableDraft ? 1 : 0,
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

            -- LOGO
            img.secureUrl AS logoUrl,
            img.publicId AS logoPublicId,
            img.originalName AS logoOriginalName,

            -- ESTADÍSTICAS
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

        -- LOGO DEL EQUIPO
        LEFT JOIN image img ON img.id = t.idLogo

        -- ESTADÍSTICAS
        LEFT JOIN team_statistics ts 
            ON ts.teamId = t.id 
            AND ts.tournamentId = ?

        WHERE tt.tournamentId = ?
        ORDER BY points DESC, goalDifference DESC, goalsFor DESC;
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
}
