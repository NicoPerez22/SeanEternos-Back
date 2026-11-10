import {
  callProcedureRows,
  callProcedureCommand,
} from 'shared/database/stored-procedure';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Player } from './entity/player.entity';
import { ApiResponse } from 'shared/models/apiResponse';
import { Team } from 'src/team/entity/team.entity';
import { ImagesService } from 'shared/services/images/images.service';
import {
  CreateTransferOfferDto,
  ReviewTransferOfferDto,
} from './dto/transferOffert';

type PlayerTeamRow = {
  id: number;
  name: string;
  lastName: string;
  valoration: number;
  photo: string | null;
  isHabilitado: number;
  position: string;
  idTeam: number | null;

  teamId: number | null;
  teamName: string | null;
  teamAbreviatura: string | null;
  teamIdLogo: number | null;
  teamUserId: number | null;
};

type TeamPayload = {
  id: number;
  name: string;
  abreviatura: string;
  idLogo: number | null;
  userId: number | null;
  logo: any | null;
};

type PlayerWithTeamPayload = {
  id: number;
  name: string;
  lastName: string;
  valoration: number;
  photo: string | null;
  isHabilitado: number;
  position: string;
  fullName: string;
  team: TeamPayload | null;
};

@Injectable()
export class PlayerService {
  constructor(
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    private readonly imageService: ImagesService,
    private readonly dataSource: DataSource,
  ) {}

  async createPlayer(player: any) {
    const apiResponse = new ApiResponse<Player>();

    try {
      const playerNew = this.playerRepository.create({
        name: player.name,
        lastName: player.lastName,
        valoration: player.valoration,
        photo: player.photo,
        team: { id: Number(player.teamId) },
        idTeam: Number(player.teamId),
        isTransfer: false,
        isHabilitado: player.isHabilitado,
        position: player.position,
      });

      const resp = await this.playerRepository.save(playerNew);
      return {
        ...apiResponse,
        data: resp,
        httpCode: HttpStatus.OK,
        message: 'Jugador creado con exito',
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

  async deletePlayer(id: number) {
    try {
      const result = await this.playerRepository.delete(id);
      if (!result.affected) {
        throw new NotFoundException('El jugador no existe');
      }
      return {
        data: { id },
        httpCode: HttpStatus.OK,
        message: 'Jugador eliminado con éxito',
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new ConflictException(
        'No se pudo eliminar el jugador. Puede tener registros asociados.',
      );
    }
  }

  async updatePlayer(id: number, palyer: any) {
    const apiResponse = new ApiResponse<Player>();

    try {
      const playerExist = await this.playerRepository.findOneBy({ id });

      if (!playerExist) {
        return {
          ...apiResponse,
          data: null,
          httpCode: HttpStatus.OK,
          message: 'El jugador no existe',
        };
      }

      const resp = await this.playerRepository.update({ id }, palyer);

      return {
        ...apiResponse,
        data: resp,
        httpCode: HttpStatus.OK,
        message: 'Jugador actualizado con exito',
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

  async transferPlayers(playerId: number, teamId: number) {
    const apiResponse = new ApiResponse<Player>();

    try {
      const player = await this.playerRepository.findOne({
        where: { id: playerId },
      });

      const newTeam = await this.teamRepository.findOne({
        where: { id: teamId },
      });

      if (!player) {
        return {
          ...apiResponse,
          data: null,
          httpCode: HttpStatus.OK,
          message: 'Jugador no encontrado',
        };
      }

      if (!newTeam) {
        return {
          ...apiResponse,
          data: null,
          httpCode: 404,
          message: 'Equipo destino no encontrado',
        };
      }

      player.team = newTeam;
      const resp = await this.playerRepository.save(player);

      return {
        ...apiResponse,
        data: resp,
        httpCode: 200,
        message: 'Transferencia realizada con éxito',
      };
    } catch (error) {
      return {
        ...apiResponse,
        data: null,
        httpCode: 500,
        message: `Error al transferir el jugador: ${error.message}`,
      };
    }
  }

  async removeAllPlayersFromTeams() {
    const apiResponse = new ApiResponse<any>();

    try {
      const result = await callProcedureCommand(
        this.dataSource,
        'sp_ap_remove_players_from_teams',
      );
      const resp = {
        raw: result,
        generatedMaps: [],
        affected: result.affectedRows,
      };

      return {
        ...apiResponse,
        data: resp,
        httpCode: HttpStatus.OK,
        message: `Se han removido ${resp.affected} jugadores de sus equipos.`,
      };
    } catch (error) {
      return {
        ...apiResponse,
        data: null,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error al remover los jugadores de los equipos: ${error.message}`,
      };
    }
  }

  async getPLayersByIdTeams(teamId: number) {
    const apiResponse = new ApiResponse<any[]>();

    try {
      const players = await this.playerRepository.find({
        where: {
          team: { id: teamId },
        },
        relations: ['team'],
      });

      if (!players || players.length === 0) {
        return {
          ...apiResponse,
          data: [],
          httpCode: HttpStatus.OK,
          message: 'No existen jugadores para ese equipo',
        };
      }

      return {
        ...apiResponse,
        data: players,
        httpCode: HttpStatus.OK,
        message: '',
      };
    } catch (error) {
      return {
        ...apiResponse,
        data: null,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error al cargar los jugadores: ${error.message}`,
      };
    }
  }

  async getPlayers() {
    const apiResponse = new ApiResponse<any[]>();

    try {
      // const players = await this.playerRepository.find({
      //   relations: ['team'],
      //   order: { valoration: 'DESC' },
      // });

      // if (!players?.length) {
      //   return {
      //     ...apiResponse,
      //     data: null,
      //     httpCode: HttpStatus.OK,
      //     message: 'No existen jugadores registrados',
      //   };
      // }

      // const playersWithTeam = await Promise.all(
      //   players.map(async (player) => {
      //     const {
      //       id,
      //       name,
      //       lastName,
      //       valoration,
      //       photo,
      //       isHabilitado,
      //       position,
      //       team,
      //     } = player;

      //     const teamWithLogo = team
      //       ? {
      //           ...team,
      //           logo: await this.imageService.getImage(team.idLogo),
      //         }
      //       : null;

      //     return {
      //       id,
      //       name,
      //       lastName,
      //       valoration,
      //       photo,
      //       isHabilitado,
      //       position,
      //       team: teamWithLogo,
      //       fullName: `${name} ${lastName}`,
      //     };
      //   }),
      // );

      return {
        ...apiResponse,
        httpCode: HttpStatus.OK,
        message: '',
        data: null,
      };
    } catch (error) {
      return {
        ...apiResponse,
        data: null,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error al cargar los jugadores: ${error.message}`,
      };
    }
  }

  async getPlayersWithTeams(): Promise<ApiResponse<PlayerWithTeamPayload[]>> {
    const apiResponse = new ApiResponse<PlayerWithTeamPayload[]>();

    try {
      const rows = await this.fetchPlayersWithTeams();

      if (rows.length === 0) {
        return {
          ...apiResponse,
          data: [],
          httpCode: HttpStatus.OK,
          message: 'No existen jugadores asignados a equipos',
        };
      }

      const getTeamLogo = this.createLogoCacheLoader();

      const data = await Promise.all(
        rows.map((row) => this.mapRowToPayload(row, getTeamLogo)),
      );

      return { ...apiResponse, data, httpCode: HttpStatus.OK, message: '' };
    } catch (error: any) {
      return {
        ...apiResponse,
        data: null,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error al cargar jugadores con equipos: ${error.message}`,
      };
    }
  }

  // -------------------------
  // Data access
  // -------------------------
  private async fetchPlayersWithTeams(): Promise<PlayerTeamRow[]> {
    return callProcedureRows(
      this.dataSource,
      'sp_ap_get_transfer_players_with_teams',
      [],
    );
  }

  // -------------------------
  // Logo loader with cache
  // -------------------------
  private createLogoCacheLoader() {
    const cache = new Map<number, any>();

    return async (idLogo: number | null | undefined) => {
      if (idLogo === null || idLogo === undefined) return null;

      const key = Number(idLogo);
      if (!Number.isFinite(key) || key <= 0) return null;

      if (cache.has(key)) return cache.get(key);

      const logo = await this.imageService.getImage(key);
      cache.set(key, logo);
      return logo ?? null;
    };
  }

  // -------------------------
  // Mapping
  // -------------------------
  private async mapRowToPayload(
    row: PlayerTeamRow,
    getTeamLogo: (idLogo: number | null | undefined) => Promise<any | null>,
  ): Promise<PlayerWithTeamPayload> {
    const team = await this.mapTeam(row, getTeamLogo);

    return {
      id: Number(row.id),
      name: row.name,
      lastName: row.lastName,
      valoration: Number(row.valoration),
      photo: row.photo ?? null,
      isHabilitado: Number(row.isHabilitado),
      position: row.position,
      fullName: `${row.name} ${row.lastName}`,
      team,
    };
  }

  private async mapTeam(
    row: PlayerTeamRow,
    getTeamLogo: (idLogo: number | null | undefined) => Promise<any | null>,
  ): Promise<TeamPayload | null> {
    if (row.teamId === null || row.teamId === undefined) return null;

    const idLogo = row.teamIdLogo !== null ? Number(row.teamIdLogo) : null;

    return {
      id: Number(row.teamId),
      name: row.teamName ?? '',
      abreviatura: row.teamAbreviatura ?? '',
      idLogo,
      userId: row.teamUserId !== null ? Number(row.teamUserId) : null,
      logo: await getTeamLogo(idLogo),
    };
  }

  async assignPlayerTransfer(id: number, isTransfer: boolean) {
    const apiResponse = new ApiResponse<Player>();

    try {
      const player = await this.playerRepository.findOne({
        where: { id },
      });

      if (!player) {
        return {
          ...apiResponse,
          data: null,
          httpCode: HttpStatus.NOT_FOUND,
          message: 'Jugador no encontrado',
        };
      }

      player.isTransfer = isTransfer;
      await this.playerRepository.save(player);

      return {
        ...apiResponse,
        data: player,
        httpCode: HttpStatus.OK,
        message: 'Estado de transferencia actualizado',
      };
    } catch (error) {
      return {
        ...apiResponse,
        data: null,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error al actualizar el estado de transferencia: ${error.message}`,
      };
    }
  }

  async disabledPlayers() {
    const apiResponse = new ApiResponse<any[]>();

    try {
      const players = await this.playerRepository.find({
        where: { isHabilitado: false },
        relations: ['team'],
        order: { valoration: 'DESC' },
      });

      if (!players?.length) {
        return {
          ...apiResponse,
          data: [],
          httpCode: HttpStatus.OK,
          message: 'No existen jugadores registrados',
        };
      }

      const playersWithTeam = await Promise.all(
        players.map(
          async ({ id, photo, name, lastName, isHabilitado, team }) => {
            const teamWithLogo = team
              ? {
                  id: team.id,
                  name: team.name,
                  logo: await this.imageService.getImage(team.idLogo),
                }
              : null;

            return {
              id,
              photo,
              name,
              lastName,
              isHabilitado,
              team: teamWithLogo,
            };
          },
        ),
      );

      return {
        ...apiResponse,
        data: playersWithTeam,
        httpCode: HttpStatus.OK,
        message: '',
      };
    } catch (error) {
      return {
        ...apiResponse,
        data: null,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error al cargar los jugadores: ${error.message}`,
      };
    }
  }

  async createOffer(dto: CreateTransferOfferDto) {
    try {
      const note = dto.note ?? null;

      const targetJson = JSON.stringify(dto.targetPlayerIds);
      const offeredJson = JSON.stringify(dto.offeredPlayerIds);

      const result = await this.dataSource.query(
        `CALL sp_create_transfer_offer(?, ?, ?, ?)`,
        [dto.fromTeamId, targetJson, offeredJson, note],
      );

      const first = result?.[0];
      const rows = Array.isArray(first?.[0]) ? first[0] : first;
      const row = rows?.[0];

      return { ok: true, data: row ?? rows ?? result };
    } catch (err: any) {
      this.handleMysqlSpError(err);
    }
  }

  async reviewOffer(
    offerId: number,
    adminId: number,
    dto: ReviewTransferOfferDto,
  ) {
    try {
      const reviewNote = dto.reviewNote ?? null;

      const result = await this.dataSource.query(
        `CALL sp_review_transfer_offer(?, ?, ?, ?)`,
        [offerId, adminId, dto.action, reviewNote],
      );

      const first = result?.[0];
      const rows = Array.isArray(first?.[0]) ? first[0] : first;
      const row = rows?.[0];

      return { ok: true, data: row ?? rows ?? result };
    } catch (err: any) {
      this.handleMysqlSpError(err);
    }
  }

  async listPending(page = 1, limit = 20) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    const offset = (safePage - 1) * safeLimit;

    const totalRows = await callProcedureRows(
      this.dataSource,
      'sp_ap_count_transfer_offers',
      [null, 'pending'],
    );
    const total = Number(totalRows?.[0]?.total ?? 0);

    const rows = await callProcedureRows(
      this.dataSource,
      'sp_ap_list_transfer_offers',
      [null, 'pending', safeLimit, offset],
    );

    const data = (rows ?? []).map((r: any) => ({
      ...r,
      targetPlayers:
        typeof r.targetPlayers === 'string'
          ? JSON.parse(r.targetPlayers)
          : (r.targetPlayers ?? []),
      offeredPlayers:
        typeof r.offeredPlayers === 'string'
          ? JSON.parse(r.offeredPlayers)
          : (r.offeredPlayers ?? []),
    }));

    return {
      ok: true,
      data,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  private handleMysqlSpError(err: any): never {
    const sqlState = err?.sqlState;
    const message = err?.sqlMessage || err?.message || 'Database error';

    if (sqlState === '45000') {
      throw new BadRequestException(message);
    }

    // errores comunes de constraint / FK / etc.
    if (err?.code) {
      throw new BadRequestException(`${err.code}: ${message}`);
    }

    throw new InternalServerErrorException(message);
  }

  async getOffersByTeam(
    teamId: number,
    status?: 'pending' | 'approved' | 'rejected' | 'cancelled',
    page = 1,
    limit = 20,
  ) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    const offset = (safePage - 1) * safeLimit;

    const allowed = new Set(['pending', 'approved', 'rejected', 'cancelled']);
    if (status && !allowed.has(status)) {
      throw new BadRequestException('status inválido');
    }

    const totalRows = await callProcedureRows(
      this.dataSource,
      'sp_ap_count_transfer_offers',
      [teamId, status ?? null],
    );
    const total = Number(totalRows?.[0]?.total ?? 0);

    const rows = await callProcedureRows(
      this.dataSource,
      'sp_ap_list_transfer_offers',
      [teamId, status ?? null, safeLimit, offset],
    );

    // MySQL a veces devuelve JSON como string -> parse
    const data = (rows ?? []).map((r: any) => ({
      ...r,
      targetPlayers:
        typeof r.targetPlayers === 'string'
          ? JSON.parse(r.targetPlayers)
          : (r.targetPlayers ?? []),
      offeredPlayers:
        typeof r.offeredPlayers === 'string'
          ? JSON.parse(r.offeredPlayers)
          : (r.offeredPlayers ?? []),
    }));

    return {
      ok: true,
      meta: {
        teamId,
        status: status ?? null,
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
      data,
    };
  }

  async getInjury() {
    const apiResponse = new ApiResponse<Player>();

    try {
      const result = await this.dataSource.query(
        'CALL sp_get_injured_players()',
      );

      // CALL devuelve los registros dentro del primer result set.
      const players = result?.[0] ?? [];

      if (!players.length) {
        return {
          ...apiResponse,
          data: null,
          httpCode: HttpStatus.NOT_FOUND,
          message: 'No existen lesiones pendientes de cumplir',
        };
      }

      const getTeamLogo = this.createLogoCacheLoader();

      const playersWithTeam = await Promise.all(
        players.map(async (row: any) => {
          const { teamName, teamIdLogo, ...player } = row;

          // Nombre, ID y logo corresponden al equipo actual.
          const idTeam = player.idTeam != null ? Number(player.idTeam) : null;

          return {
            ...player,
            team:
              idTeam !== null
                ? {
                    id: idTeam,
                    name: teamName ?? '',
                    logo: await getTeamLogo(idTeam),
                  }
                : null,
          };
        }),
      );

      return {
        ...apiResponse,
        data: playersWithTeam,
        httpCode: HttpStatus.OK,
        message: 'Lesiones obtenidas correctamente',
      };
    } catch (error) {
      return {
        ...apiResponse,
        data: null,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error al obtener las lesiones: ${error.message}`,
      };
    }
  }
}
