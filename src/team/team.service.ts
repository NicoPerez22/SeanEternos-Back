import { Between, Repository, In } from 'typeorm';
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Team } from './entity/team.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiResponse } from 'shared/models/apiResponse';
import { TeamDTO } from './models/team';
import { Image } from 'src/upload/entity/image.entity';
import { Player } from 'src/player/entity/player.entity';
import { User } from 'src/user/entity/user.entity';

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(Team) private readonly teamRepository: Repository<Team>,

    @InjectRepository(Image)
    private readonly imageRepository: Repository<Image>,

    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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
        return Object.assign(apiResponse, {
          data: null,
          httpCode: HttpStatus.OK,
          message: 'Ya existe un equipo con ese nombre',
        });
      }

      const createdTeam = this.teamRepository.create({
        name: newTeam.name,
        idLogo: newTeam.idLogo,
        abreviatura: newTeam.abreviatura,
      });

      const resp = await this.teamRepository.save(createdTeam);
      return Object.assign(apiResponse, {
        data: resp,
        httpCode: HttpStatus.OK,
        message: 'Equipo creado con exito',
      });
    } catch (error) {
      return Object.assign(apiResponse, {
        data: null,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error al crear el equipo: ${error.message}`,
      });
    }
  }

  async getTeamByID(id: number) {
    const apiResponse = new ApiResponse<TeamDTO>();
    const teamDTO = new TeamDTO();

    try {
      const team = await this.teamRepository.findOne({
        where: { id: id },
        relations: ['players', 'owner'], // Incluye 'owner' en las relaciones
      });

      if (!team) {
        return Object.assign(apiResponse, {
          data: null,
          httpCode: HttpStatus.OK,
          message: 'No existe un equipo con ese ID',
        });
      }

      // Si el equipo no tiene owner, user será null
      const user = team.owner
        ? await this.userRepository.findOne({ where: { id: team.owner.id } })
        : null;

      teamDTO.id = team.id;
      teamDTO.name = team.name;
      teamDTO.abreviatura = team.abreviatura;
      teamDTO.logo = await this._getImage(team.idLogo);
      teamDTO.idLogo = team.idLogo;
      teamDTO.owner = user;

      // Agregar listado de jugadores al DTO
      teamDTO.players = team.players
        ? await Promise.all(
            team.players.map(async (player) => {
              let photo: any = null;
              if (player.photo !== null) {
                photo = await this._getImage(player.photo);
              }
              return {
                id: player.id,
                name: player.name,
                valoration: player.valoration,
                lastName: player.lastName,
                isHabilitado: player.isHabilitado,
                position: player.position,
                photo: photo || null,
              };
            }),
          )
        : [];

      return Object.assign(apiResponse, {
        data: teamDTO,
        httpCode: HttpStatus.OK,
        message: '',
      });
    } catch (error) {
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
      const teams = await this.teamRepository.find();

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
          teamDTO.logo = await this._getImage(team.idLogo);
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
          teamDTO.logo = await this._getImage(team.idLogo);
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

  async distributePlayersEqually(teamIds: number[]) {
    // Obtener todos los jugadores valorados entre 75 y 94
    const players = await this.playerRepository.find({
      where: {
        valoration: Between(75, 94),
      },
      order: {
        valoration: 'DESC',
      },
    });

    const numTeams = teamIds.length;
    if (numTeams === 0) {
      throw new Error('Debes proporcionar al menos un equipo.');
    }

    // Buscar solo los equipos cuyos IDs están en el array recibido
    const teams = await this.teamRepository.findBy({
      id: In(teamIds),
    });
    teams.sort((a, b) => a.id - b.id);

    if (teams.length !== numTeams) {
      throw new Error('Uno o más equipos no existen en la base de datos.');
    }

    // Inicializar estructura para el draft
    const draftTeams: {
      team: Team;
      players: Player[];
      totalValoracion: number;
    }[] = teams.map((team) => ({
      team,
      players: [],
      totalValoracion: 0,
    }));

    // Algoritmo de distribución tipo "snake draft"
    let direction = 1;
    let teamIndex = 0;
    for (const player of players) {
      draftTeams[teamIndex].players.push(player);
      draftTeams[teamIndex].totalValoracion += player.valoration;

      // Asignar el equipo al jugador y guardar en la base de datos
      player.team = draftTeams[teamIndex].team;
      await this.playerRepository.save(player);

      teamIndex += direction;
      if (teamIndex === numTeams) {
        direction = -1;
        teamIndex = numTeams - 1;
      } else if (teamIndex < 0) {
        direction = 1;
        teamIndex = 0;
      }
    }

    // Calcular promedios y preparar respuesta
    const result = draftTeams.map((teamDraft) => ({
      equipo: teamDraft.team.name,
      promedio:
        teamDraft.players.length > 0
          ? teamDraft.totalValoracion / teamDraft.players.length
          : 0,
      jugadores: teamDraft.players,
    }));

    return result;
  }

  async _getImage(idLogo) {
    return await this.imageRepository.findOne({
      where: {
        id: idLogo,
      },
    });
  }

  async assignTeamToUser(teamId: number, userId: number) {
    const apiResponse = new ApiResponse<Team>();

    try {
      const team = await this.teamRepository.findOne({ where: { id: teamId } });
      if (!team) {
        return Object.assign(apiResponse, {
          data: null,
          httpCode: HttpStatus.NOT_FOUND,
          message: 'Equipo no encontrado',
        });
      }

      // Busca el usuario (asegúrate de tener el repositorio de User inyectado)
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        return Object.assign(apiResponse, {
          data: null,
          httpCode: HttpStatus.NOT_FOUND,
          message: 'Usuario no encontrado',
        });
      }

      team.owner = user;
      await this.teamRepository.save(team);

      return Object.assign(apiResponse, {
        data: team,
        httpCode: HttpStatus.OK,
        message: 'Equipo asignado al usuario correctamente',
      });
    } catch (error) {
      return Object.assign(apiResponse, {
        data: null,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error al asignar el equipo: ${error.message}`,
      });
    }
  }
}
