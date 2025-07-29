import { Between, Repository, In } from 'typeorm';
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Team } from './entity/team.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiResponse } from 'shared/models/apiResponse';
import { TeamDTO } from './models/team';
import { Image } from 'src/upload/entity/image.entity';
import { Player } from 'src/player/entity/player.entity';
import { User } from 'src/user/entity/user.entity';
import { Rounds } from 'src/tournament/entity/rounds.entity';

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

    @InjectRepository(Rounds)
    private readonly roundsRepository: Repository<Rounds>,
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
        where: { id },
        relations: ['players', 'owner'],
      });

      if (!team) {
        return Object.assign(apiResponse, {
          data: null,
          httpCode: HttpStatus.OK,
          message: 'No existe un equipo con ese ID',
        });
      }

      // Owner
      const user = team.owner
        ? await this.userRepository.findOne({ where: { id: team.owner.id } })
        : null;

      // Datos del equipo
      teamDTO.id = team.id;
      teamDTO.name = team.name;
      teamDTO.abreviatura = team.abreviatura;
      teamDTO.logo = team.idLogo ? await this._getImage(team.idLogo) : null;
      teamDTO.idLogo = team.idLogo;
      teamDTO.owner = user;

      // Jugadores con foto
      teamDTO.players = team.players
        ? await Promise.all(
            team.players.map(async (player) => ({
              id: player.id,
              name: player.name,
              valoration: player.valoration,
              lastName: player.lastName,
              isHabilitado: player.isHabilitado,
              position: player.position,
              photo: player.photo ? await this._getImage(player.photo) : null,
            })),
          )
        : [];

      // Rounds donde el equipo participa (pueden ser de varios torneos)
      const rounds = await this.roundsRepository.find({
        where: [{ home: id }, { away: id }],
        relations: ['tournament', 'tournament.teams'],
      });

      if (rounds.length > 0) {
        // 1️⃣ Recolectar TODOS los equipos de TODOS los torneos involucrados
        const allTeams: any[] = [];
        rounds.forEach((round) => {
          if (round.tournament?.teams) {
            allTeams.push(...round.tournament.teams);
          }
        });

        // 2️⃣ Crear un mapa único de equipos (para evitar duplicados)
        const uniqueTeamsMap = new Map<number, any>();
        allTeams.forEach((team) => {
          if (!uniqueTeamsMap.has(team.id)) {
            uniqueTeamsMap.set(team.id, team);
          }
        });

        // 3️⃣ Agregar logos a cada equipo
        const teamsWithLogoMap = new Map<number, any>();
        for (const [teamId, teamData] of uniqueTeamsMap.entries()) {
          const logo = teamData.idLogo
            ? await this._getImage(teamData.idLogo)
            : null;
          teamsWithLogoMap.set(teamId, { ...teamData, logo });
        }

        // 4️⃣ Armar las rounds optimizadas
        teamDTO.rounds = rounds.map((round) => {
          const homeTeam = teamsWithLogoMap.get(round.home);
          const awayTeam = teamsWithLogoMap.get(round.away);

          return {
            idRound: round.id,
            round: round.round,
            state: round.state,
            teamWin: round.teamWin,
            teamLose: round.teamLose,
            tournament: round.tournament
              ? {
                  id: round.tournament.id,
                  name: round.tournament.name,
                }
              : null,
            idHome: homeTeam?.id,
            home: homeTeam?.name,
            homeLogo: homeTeam?.logo,
            idAway: awayTeam?.id,
            away: awayTeam?.name,
            awayLogo: awayTeam?.logo,
          };
        });
      } else {
        teamDTO.rounds = [];
      }

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
          teamDTO.logo = await this._getImage(team.idLogo);

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

  shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  async distributePlayersEqually(teamIds: number[]) {
    const players = await this.playerRepository.find({
      where: { valoration: Between(78, 94) },
      order: { valoration: 'DESC' },
    });

    // Mezcla los jugadores para que la distribución sea aleatoria
    const shuffledPlayers = this.shuffleArray([...players]);

    const teams = await this.teamRepository.findBy({ id: In(teamIds) });
    teams.sort((a, b) => a.id - b.id);

    // Definición de posiciones requeridas
    const requiredPositions = [
      { position: 'GK', count: 1 },
      { position: 'DFC', count: 3 },
      { position: 'DFD', count: 1 },
      { position: 'DFI', count: 1 },
      { position: 'MCD', count: 2 },
      { position: 'MC', count: 3 },
      { position: 'MD', count: 1 },
      { position: 'MI', count: 1 },
      { position: 'MCO', count: 1 },
      { position: 'DC', count: 1 },
    ];
    const PLAYERS_PER_TEAM = 22;
    const MIN_AVG = 79.2;
    const MAX_AVG = 80.2;

    let availablePlayers = [...shuffledPlayers];

    const draftTeams: {
      team: Team;
      players: Player[];
      totalValoracion: number;
      avgValoracion: number;
    }[] = [];

    for (const team of teams) {
      let assignedPlayers: Player[] = [];
      let attempts = 0;
      let avg = 0;

      while (attempts < 1000) {
        let tempPlayers: Player[] = [];
        let usedIndexes = new Set<number>();

        // Asignar posiciones obligatorias
        for (const req of requiredPositions) {
          const candidates = availablePlayers
            .map((p, idx) => ({ p, idx }))
            .filter(
              ({ p, idx }) =>
                p.position === req.position && !usedIndexes.has(idx),
            );
          if (candidates.length < req.count) break;

          for (let i = 0; i < req.count; i++) {
            const randIdx = Math.floor(Math.random() * candidates.length);
            const { p, idx } = candidates[randIdx];
            tempPlayers.push(p);
            usedIndexes.add(idx);
            candidates.splice(randIdx, 1);
          }
        }

        if (tempPlayers.length < 16) {
          attempts++;
          continue;
        }

        // Asignar el resto de jugadores al azar
        const remaining = PLAYERS_PER_TEAM - tempPlayers.length;
        const restCandidates = availablePlayers
          .map((p, idx) => ({ p, idx }))
          .filter(({ idx }) => !usedIndexes.has(idx));
        if (restCandidates.length < remaining) break;

        for (let i = 0; i < remaining; i++) {
          const randIdx = Math.floor(Math.random() * restCandidates.length);
          const { p, idx } = restCandidates[randIdx];
          tempPlayers.push(p);
          usedIndexes.add(idx);
          restCandidates.splice(randIdx, 1);
        }

        avg =
          tempPlayers.reduce((sum, p) => sum + p.valoration, 0) /
          PLAYERS_PER_TEAM;

        if (avg >= MIN_AVG && avg <= MAX_AVG) {
          assignedPlayers = tempPlayers;
          break;
        }
        attempts++;
      }

      if (assignedPlayers.length !== PLAYERS_PER_TEAM) {
        assignedPlayers = availablePlayers.slice(0, PLAYERS_PER_TEAM);
        avg =
          assignedPlayers.reduce((sum, p) => sum + p.valoration, 0) /
          PLAYERS_PER_TEAM;
      }

      for (const player of assignedPlayers) {
        player.team = team;
      }
      availablePlayers = availablePlayers.filter(
        (p) => !assignedPlayers.includes(p),
      );

      draftTeams.push({
        team,
        players: assignedPlayers,
        totalValoracion: assignedPlayers.reduce(
          (sum, p) => sum + p.valoration,
          0,
        ),
        avgValoracion: avg,
      });
    }

    await this.playerRepository.save(players);

    return draftTeams;
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
