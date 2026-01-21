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
