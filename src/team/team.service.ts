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
    private readonly dataSource: DataSource,
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

      const teamRows = result?.[0] ?? [];
      const playersRows = result?.[1] ?? [];

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

  async updateTeam(id: number, teamdto: any) {
    const apiResponse = new ApiResponse<Team>();

    try {
      const team = await this.teamRepository.findOne({
        where: {
          name: teamdto?.name,
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

      const createdTeam = this.teamRepository.update({ id }, {
        name: teamdto.name,
        idLogo: teamdto.idLogo,
        abreviatura: teamdto.abreviatura,
      });

      const resp = await this.teamRepository.update({ id }, teamdto);
      return {
        ...apiResponse,
        data: resp,
        httpCode: HttpStatus.OK,
        message: 'Equipo Editado con exito',
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

  async delete(id: number) {
    const apiResponse = new ApiResponse<TeamDTO[]>();
  
    try {
      // 1) Verificar existencia del equipo
      const team = await this.teamRepository.findOne({ where: { id } });
  
      if (!team) {
        return Object.assign(apiResponse, {
          data: null,
          httpCode: HttpStatus.OK,
          message: 'No existe un equipo con ese ID para eliminar',
        });
      }
  
      // 2) Transacción: borrar eventos -> borrar equipo
      let deletedEventsCount = 0;
  
      await this.dataSource.transaction(async (manager) => {
        // Contar eventos (opcional, para mensaje)
        const [{ total }] = await manager.query(
          `SELECT COUNT(*) AS total FROM match_events WHERE teamId = ?`,
          [id],
        );
        deletedEventsCount = Number(total) || 0;
  
        // Borrar eventos asociados
        await manager.query(`DELETE FROM match_events WHERE teamId = ?`, [id]);
  
        // Borrar el equipo
        const deleteResult = await manager.delete('teams', { id });
  
        if (!deleteResult.affected) {
          // Si por alguna razón no borró, tiramos error para rollback
          throw new Error('No se pudo eliminar el equipo');
        }
      });
  
      // 3) Obtener equipos restantes
      const remainingTeams = await this.teamRepository.find();
  
      if (!remainingTeams || remainingTeams.length === 0) {
        return Object.assign(apiResponse, {
          data: null,
          httpCode: HttpStatus.OK,
          message:
            deletedEventsCount > 0
              ? `Equipo eliminado con éxito. También se eliminaron ${deletedEventsCount} evento(s) asociados. Ya no quedan equipos registrados.`
              : 'Equipo eliminado con éxito. Ya no quedan equipos registrados.',
        });
      }
  
      // 4) Mapear a DTO
      const teamDTOs = await Promise.all(
        remainingTeams.map(async (t) => {
          const dto = new TeamDTO();
          dto.id = t.id;
          dto.name = t.name;
          dto.abreviatura = t.abreviatura;
          dto.idLogo = t.idLogo;
          dto.logo = await this.imageServices.getImage(t.idLogo);
          return dto;
        }),
      );
  
      return Object.assign(apiResponse, {
        data: teamDTOs,
        httpCode: HttpStatus.OK,
        message:
          deletedEventsCount > 0
            ? `Equipo eliminado con éxito. También se eliminaron ${deletedEventsCount} evento(s) asociados.`
            : 'Equipo eliminado con éxito',
      });
    } catch (error) {
      return Object.assign(apiResponse, {
        data: null,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error al eliminar el equipo: ${error?.message ?? error}`,
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
