import { Between, Repository, In, DataSource } from 'typeorm';
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Team } from './entity/team.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiResponse } from 'shared/models/apiResponse';
import { TeamDTO } from './models/team';
import { Player } from 'src/player/entity/player.entity';
import { User } from 'src/user/entity/user.entity';
import { Rounds } from 'src/tournament/entity/rounds.entity';
import { ImagesService } from 'shared/services/images/images.service';

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(Team) private readonly teamRepository: Repository<Team>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Rounds)
    private readonly roundsRepository: Repository<Rounds>,
    private readonly DataSource: DataSource,
    private readonly imageServices: ImagesService,
  ) {}

  async createTeam(newTeam: TeamDTO) {
    const apiResponse = new ApiResponse<Team>();

    try {
      const team = await this.teamRepository.findOne({
        where: {
          name: newTeam?.name,
        },
      });

      if (team) {
        return {
          ...apiResponse,
          data: null,
          httpCode: HttpStatus.OK,
          message: 'Ya existe un equipo con ese nombre',
        };
      }

      const createdTeam = this.teamRepository.create({
        name: newTeam.name,
        idLogo: newTeam.idLogo,
        abreviatura: newTeam.abreviatura,
      });

      const resp = await this.teamRepository.save(createdTeam);
      return {
        ...apiResponse,
        data: resp,
        httpCode: HttpStatus.OK,
        message: 'Equipo creado con exito',
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

  async getTeamByID(id: number) {
    const apiResponse = new ApiResponse<TeamDTO>();

    try {
      const result = await this.DataSource.query('CALL sp_get_team_detail(?)', [
        id,
      ]);

      // MySQL suele devolver: [rs1, rs2, rs3, ...]
      const teamRows = result?.[0] ?? [];
      const playersRows = result?.[1] ?? [];
      const roundsRows = result?.[2] ?? [];

      if (!teamRows.length) {
        return Object.assign(apiResponse, {
          data: null,
          httpCode: HttpStatus.OK,
          message: 'No existe un equipo con ese ID',
        });
      }

      const teamRow = teamRows[0];

      // Cache de logos para evitar repetir llamadas
      const logoCache = new Map<number, any>();
      const getLogoCached = async (idLogo?: number | null) => {
        if (!idLogo) return null;
        const key = Number(idLogo);
        if (logoCache.has(key)) return logoCache.get(key);
        const img = await this.imageServices.getImage(key);
        logoCache.set(key, img);
        return img;
      };

      const teamDTO = new TeamDTO();
      teamDTO.id = Number(teamRow.teamId);
      teamDTO.name = teamRow.teamName;
      teamDTO.abreviatura = teamRow.abreviatura;
      teamDTO.idLogo = teamRow.idLogo ? Number(teamRow.idLogo) : null;
      teamDTO.logo = await getLogoCached(teamDTO.idLogo);

      teamDTO.owner = teamRow.ownerId
        ? {
            id: Number(teamRow.ownerId),
            name: teamRow.ownerName,
            lastName: teamRow.ownerLastName,
            email: teamRow.ownerEmail,
          }
        : null;

      teamDTO.players = (playersRows ?? []).map((p: any) => ({
        id: Number(p.id),
        name: p.name,
        lastName: p.lastName,
        valoration: Number(p.valoration),
        isHabilitado: Number(p.isHabilitado),
        position: p.position,
        isTransfer: Number(p.isTransfer),
      }));

      // Rounds + logos
      teamDTO.rounds = await Promise.all(
        (roundsRows ?? []).map(async (r: any) => ({
          idRound: Number(r.idRound),
          round: Number(r.roundNumber),
          state: r.state,
          teamWin: r.teamWin !== null ? Number(r.teamWin) : null,
          teamLose: r.teamLose !== null ? Number(r.teamLose) : null,
          tournament: r.tournamentId
            ? { id: Number(r.tournamentId), name: r.tournamentName }
            : null,

          idHome: r.homeId !== null ? Number(r.homeId) : null,
          home: r.homeName ?? null,
          homeLogo: await getLogoCached(
            r.homeIdLogo ? Number(r.homeIdLogo) : null,
          ),

          idAway: r.awayId !== null ? Number(r.awayId) : null,
          away: r.awayName ?? null,
          awayLogo: await getLogoCached(
            r.awayIdLogo ? Number(r.awayIdLogo) : null,
          ),
        })),
      );

      return Object.assign(apiResponse, {
        data: teamDTO,
        httpCode: HttpStatus.OK,
        message: '',
      });
    } catch (error: any) {
      return Object.assign(apiResponse, {
        data: null,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error al cargar el equipo: ${error.message}`,
      });
    }
  }

  async getTeams() {
    const apiResponse = new ApiResponse<TeamDTO[]>();

    try {
      const teams = await this.teamRepository.find({
        relations: ['owner'],
      });

      if (!teams || teams.length === 0) {
        return Object.assign(apiResponse, {
          data: null,
          httpCode: HttpStatus.OK,
          message: 'No existen equipos registrados',
        });
      }

      const teamDTOs = await Promise.all(
        teams.map(async (team) => {
          const teamDTO = new TeamDTO();
          teamDTO.id = team.id;
          teamDTO.name = team.name;
          teamDTO.abreviatura = team.abreviatura;
          teamDTO.idLogo = team.idLogo;
          teamDTO.logo = await this.imageServices.getImage(team.idLogo);

          // Busca el owner solo si existe
          teamDTO.owner = team.owner
            ? await this.userRepository.findOne({
                where: { id: team.owner.id },
              })
            : null;

          return teamDTO;
        }),
      );

      return Object.assign(apiResponse, {
        data: teamDTOs,
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

  async updateTeam(id: number, user: any) {
    return await this.teamRepository.update({ id }, user);
  }

  async delete(id: number) {
    const apiResponse = new ApiResponse<TeamDTO[]>();

    try {
      // Eliminar el equipo por ID
      const deleteResult = await this.teamRepository.delete({ id });

      if (deleteResult.affected === 0) {
        return Object.assign(apiResponse, {
          data: null,
          httpCode: HttpStatus.OK,
          message: 'No existe un equipo con ese ID para eliminar',
        });
      }

      // Obtener los equipos restantes
      const remainingTeams = await this.teamRepository.find();

      if (!remainingTeams || remainingTeams.length === 0) {
        return Object.assign(apiResponse, {
          data: null,
          httpCode: HttpStatus.OK,
          message: 'No existen equipos registrados',
        });
      }

      // Mapear los equipos restantes a objetos TeamDTO
      const teamDTOs = await Promise.all(
        remainingTeams.map(async (team) => {
          const teamDTO = new TeamDTO();
          teamDTO.id = team.id;
          teamDTO.name = team.name;
          teamDTO.abreviatura = team.abreviatura;
          teamDTO.idLogo = team.idLogo;
          teamDTO.logo = await this.imageServices.getImage(team.idLogo);
          return teamDTO;
        }),
      );

      return Object.assign(apiResponse, {
        data: teamDTOs,
        httpCode: HttpStatus.OK,
        message: 'Equipo eliminado con éxito',
      });
    } catch (error) {
      return Object.assign(apiResponse, {
        data: null,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error al eliminar el equipo: ${error.message}`,
      });
    }
  }

  shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  async distributePlayersEqually(teamIds: number[]) {
    const queryRunner = this.DataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // ✅ 1. Traer jugadores y equipos
      const players = await queryRunner.manager.find(Player, {
        where: { valoration: Between(77, 94) },
        order: { valoration: 'DESC' },
      });

      const teams = await queryRunner.manager.find(Team, {
        where: { id: In(teamIds) },
        order: { id: 'ASC' },
      });

      const PLAYERS_PER_TEAM = 22;
      const MIN_AVG = 79.5;
      const MAX_AVG = 80.2;

      // ✅ 2. Reservar jugadores TOP por grupos
      const group88 = players.filter((p) => p.valoration === 88);
      const group89_91 = players.filter(
        (p) => p.valoration >= 89 && p.valoration <= 91,
      );
      const group87 = players.filter((p) => p.valoration === 87);
      const group85_86 = players.filter(
        (p) => p.valoration >= 85 && p.valoration <= 86,
      );

      // ✅ Validación estricta: ¿hay suficientes para todos los equipos?
      if (
        group88.length < teams.length ||
        group89_91.length < teams.length ||
        group87.length < teams.length ||
        group85_86.length < teams.length
      ) {
        throw new Error(
          'No hay suficientes jugadores para los rangos TOP definidos.',
        );
      }

      // ✅ IDs reservados para no usarlos en posiciones
      const reservedTopIds = [
        ...group88.map((p) => p.id),
        ...group89_91.map((p) => p.id),
        ...group87.map((p) => p.id),
        ...group85_86.map((p) => p.id),
      ];

      // ✅ Jugadores restantes para posiciones
      let remainingPlayers = players.filter(
        (p) => !reservedTopIds.includes(p.id),
      );

      // ✅ 3. Inicializar equipos
      const draftTeams = teams.map((team) => ({
        team,
        players: [] as Player[],
        totalValoracion: 0,
        avgValoracion: 0,
      }));

      // ✅ 4. Posiciones requeridas
      const requiredPositions = [
        { positions: ['POR'], count: 1 },
        { positions: ['DFC'], count: 3 },
        { positions: ['LD'], count: 2 },
        { positions: ['LI'], count: 2 },
        { positions: ['MCD'], count: 2 },
        { positions: ['MC'], count: 3 },
        { positions: ['MD', 'ED'], count: 2 },
        { positions: ['MI', 'EI'], count: 2 },
        { positions: ['MCO'], count: 2 },
        { positions: ['DC'], count: 3 },
      ];

      // ✅ 5. Asignar posiciones obligatorias (solo jugadores fuera de TOP)
      for (const team of draftTeams) {
        for (const req of requiredPositions) {
          let countAssigned = 0;
          while (countAssigned < req.count) {
            const candidateIndex = remainingPlayers.findIndex((p) =>
              req.positions.includes(p.position),
            );
            if (candidateIndex === -1) {
              throw new Error(
                `No hay suficientes jugadores para posiciones: ${req.positions.join(', ')}`,
              );
            }
            const player = remainingPlayers.splice(candidateIndex, 1)[0];
            if (team.players.length < PLAYERS_PER_TEAM) {
              team.players.push(player);
              team.totalValoracion += player.valoration;
              countAssigned++;
            } else {
              break;
            }
          }
        }
      }

      // ✅ 6. Función para asignar exactamente 1 jugador TOP por equipo (si falta)
      const assignTopPlayersStrict = (
        group: Player[],
        checkFn: (p: Player) => boolean,
      ) => {
        for (const team of draftTeams) {
          if (team.players.length >= PLAYERS_PER_TEAM) continue;
          const alreadyHas = team.players.some(checkFn);
          if (!alreadyHas && group.length > 0) {
            const player = group.shift()!;
            team.players.push(player);
            team.totalValoracion += player.valoration;
          }
        }
      };

      // ✅ 7. Asignar los 4 TOP por equipo
      assignTopPlayersStrict(group88, (p) => p.valoration === 88);
      assignTopPlayersStrict(
        group89_91,
        (p) => p.valoration >= 89 && p.valoration <= 91,
      );
      assignTopPlayersStrict(group87, (p) => p.valoration === 87);
      assignTopPlayersStrict(
        group85_86,
        (p) => p.valoration >= 85 && p.valoration <= 86,
      );

      // ✅ 8. Recalcular grupos restantes
      const midPlayers = remainingPlayers.filter(
        (p) => p.valoration >= 80 && p.valoration <= 84,
      );
      const lowPlayers = remainingPlayers.filter(
        (p) => p.valoration >= 77 && p.valoration <= 79,
      );
      const extraPlayers = lowPlayers.filter(
        (p) => p.valoration >= 78 && p.valoration <= 79,
      );

      const assignOnePerTeam = (group: Player[]) => {
        for (const team of draftTeams) {
          if (group.length === 0) break;
          if (team.players.length >= PLAYERS_PER_TEAM) continue;
          const player = group.shift()!;
          team.players.push(player);
          team.totalValoracion += player.valoration;
        }
      };

      // ✅ 9. Mid players (80-84)
      for (let i = 0; i < 8; i++) {
        for (const team of draftTeams) {
          if (team.players.length >= PLAYERS_PER_TEAM) continue;
          if (midPlayers.length === 0) break;
          const player = midPlayers.shift()!;
          team.players.push(player);
          team.totalValoracion += player.valoration;
        }
      }

      // ✅ 10. Low players (77-79)
      for (let i = 0; i < 8; i++) {
        for (const team of draftTeams) {
          if (team.players.length >= PLAYERS_PER_TEAM) continue;
          if (lowPlayers.length === 0) break;
          const player = lowPlayers.shift()!;
          team.players.push(player);
          team.totalValoracion += player.valoration;
        }
      }

      // ✅ 11. Extras
      for (let i = 0; i < 2; i++) {
        for (const team of draftTeams) {
          if (team.players.length >= PLAYERS_PER_TEAM) continue;
          if (extraPlayers.length === 0) break;
          const player = extraPlayers.shift()!;
          team.players.push(player);
          team.totalValoracion += player.valoration;
        }
      }

      // ✅ 12. Completar si falta (sin pasar de 22)
      let idx = 0;
      while (remainingPlayers.length > 0) {
        const team = draftTeams[idx % draftTeams.length];
        if (team.players.length < PLAYERS_PER_TEAM) {
          const player = remainingPlayers.shift()!;
          team.players.push(player);
          team.totalValoracion += player.valoration;
        }
        idx++;
        if (draftTeams.every((t) => t.players.length >= PLAYERS_PER_TEAM))
          break;
      }

      // ✅ 13. Calcular promedios
      draftTeams.forEach(
        (t) => (t.avgValoracion = t.totalValoracion / PLAYERS_PER_TEAM),
      );

      // ✅ 14. Balancear promedios
      let attempts = 0;
      const MAX_ATTEMPTS = 300;
      while (attempts < MAX_ATTEMPTS) {
        const overTeam = draftTeams.find((t) => t.avgValoracion > MAX_AVG);
        const underTeam = draftTeams.find((t) => t.avgValoracion < MIN_AVG);
        if (!overTeam || !underTeam) break;

        const highPlayer = [...overTeam.players].sort(
          (a, b) => b.valoration - a.valoration,
        )[0];
        const lowPlayer = [...underTeam.players].sort(
          (a, b) => a.valoration - b.valoration,
        )[0];

        if (highPlayer && lowPlayer) {
          overTeam.players.splice(overTeam.players.indexOf(highPlayer), 1);
          underTeam.players.splice(underTeam.players.indexOf(lowPlayer), 1);

          overTeam.players.push(lowPlayer);
          underTeam.players.push(highPlayer);

          overTeam.totalValoracion = overTeam.players.reduce(
            (s, p) => s + p.valoration,
            0,
          );
          underTeam.totalValoracion = underTeam.players.reduce(
            (s, p) => s + p.valoration,
            0,
          );

          overTeam.avgValoracion = overTeam.totalValoracion / PLAYERS_PER_TEAM;
          underTeam.avgValoracion =
            underTeam.totalValoracion / PLAYERS_PER_TEAM;
        }

        attempts++;
      }

      // ✅ 15. Guardar cambios en BD
      for (const team of draftTeams) {
        for (const player of team.players) {
          player.team = team.team;
        }
      }
      await queryRunner.manager.save(players);

      await queryRunner.commitTransaction();
      return draftTeams;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async assignTeamToUser(teamId: number, userId: number) {
    const apiResponse = new ApiResponse<Team>();
    const queryRunner = this.DataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const team = await queryRunner.manager.findOne(Team, {
        where: { id: teamId },
      });
      if (!team) {
        await queryRunner.rollbackTransaction();
        return Object.assign(apiResponse, {
          data: null,
          httpCode: HttpStatus.NOT_FOUND,
          message: 'Equipo no encontrado',
        });
      }

      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
      });
      if (!user) {
        await queryRunner.rollbackTransaction();
        return Object.assign(apiResponse, {
          data: null,
          httpCode: HttpStatus.NOT_FOUND,
          message: 'Usuario no encontrado',
        });
      }

      // ✅ Verificar si el usuario ya tiene un equipo asignado
      const previousTeam = await queryRunner.manager.findOne(Team, {
        where: { owner: { id: userId } },
      });

      if (previousTeam && previousTeam.id !== teamId) {
        previousTeam.owner = null; // Quitamos la relación
        await queryRunner.manager.save(previousTeam);
      }

      // ✅ Asignar el nuevo equipo
      team.owner = user;
      await queryRunner.manager.save(team);

      await queryRunner.commitTransaction();

      return Object.assign(apiResponse, {
        data: team,
        httpCode: HttpStatus.OK,
        message: 'Equipo asignado al usuario correctamente',
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return Object.assign(apiResponse, {
        data: null,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error al asignar el equipo: ${error.message}`,
      });
    } finally {
      await queryRunner.release();
    }
  }
}
