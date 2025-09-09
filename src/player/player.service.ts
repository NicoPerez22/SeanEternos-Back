import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from './entity/player.entity';
import { ApiResponse } from 'shared/models/apiResponse';
import { Team } from 'src/team/entity/team.entity';
import { ImagesService } from 'shared/services/images/images.service';

@Injectable()
export class PlayerService {
  constructor(
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    private readonly imageService: ImagesService,
  ) {}

  async createPlayer(player: any) {
    const apiResponse = new ApiResponse<Player>();

    try {
      const playerNew = this.playerRepository.create({
        name: player.name,
        lastName: player.lastName,
        valoration: player.valoration,
        photo: player.photo,
        team: player.teamId,
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
      const resp = await this.playerRepository
        .createQueryBuilder()
        .update(Player)
        .set({ team: null })
        .where('teamId IS NOT NULL')
        .execute();

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
      const players = await this.playerRepository.find({
        relations: ['team'],
        order: { valoration: 'DESC' },
      });

      if (!players?.length) {
        return {
          ...apiResponse,
          data: null,
          httpCode: HttpStatus.OK,
          message: 'No existen jugadores registrados',
        };
      }

      const playersWithTeam = await Promise.all(
        players.map(async (player) => {
          const {
            id,
            name,
            lastName,
            valoration,
            photo,
            isHabilitado,
            position,
            team,
          } = player;

          const teamWithLogo = team
            ? {
                ...team,
                logo: await this.imageService.getImage(team.idLogo),
              }
            : null;

          return {
            id,
            name,
            lastName,
            valoration,
            photo,
            isHabilitado,
            position,
            team: teamWithLogo,
            fullName: `${name} ${lastName}`,
          };
        }),
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

  async getPlayersWithTeams() {
    const apiResponse = new ApiResponse<any[]>();

    try {
      const players = await this.playerRepository.find({
        where: { isTransfer: true },
        relations: ['team'],
        order: { valoration: 'DESC' },
      });

      if (!players?.length) {
        return {
          ...apiResponse,
          data: [],
          httpCode: HttpStatus.OK,
          message: 'No existen jugadores asignados a equipos',
        };
      }

      const playersWithTeam = await Promise.all(
        players.map(async (player) => {
          const {
            id,
            name,
            lastName,
            valoration,
            photo,
            isHabilitado,
            position,
            team,
          } = player;

          const teamWithLogo = team
            ? { ...team, logo: await this.imageService.getImage(team.idLogo) }
            : null;

          return {
            id,
            name,
            lastName,
            valoration,
            photo,
            isHabilitado,
            position,
            fullName: `${name} ${lastName}`,
            team: teamWithLogo,
          };
        }),
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
        message: `Error al cargar jugadores con equipos: ${error.message}`,
      };
    }
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
}
