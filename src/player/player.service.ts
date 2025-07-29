import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Image } from 'src/upload/entity/image.entity';
import { IsNull, Not, Repository } from 'typeorm';
import { Player } from './entity/player.entity';
import { ApiResponse } from 'shared/models/apiResponse';
import * as puppeteer from 'puppeteer';

import axios from 'axios';
import * as cheerio from 'cheerio';
import { Team } from 'src/team/entity/team.entity';

@Injectable()
export class PlayerService {
  constructor(
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    @InjectRepository(Image)
    private readonly imageRepository: Repository<Image>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
  ) {}

  async createPlayer(player: any) {
    const apiResponse = new ApiResponse<Player>();

    try {
      //   const team = await this.playerRepository.findOne({
      //     where: {
      //       name: player?.name,
      //     },
      //   });

      //   if (team) {
      //     return Object.assign(apiResponse, {
      //       data: null,
      //       httpCode: HttpStatus.OK,
      //       message: 'Ya existe un equipo con ese nombre',
      //     });
      //   }

      const createdPlayer = this.playerRepository.create({
        name: player.name,
        lastName: player.lastName,
        valoration: player.valoration,
        photo: player.photo,
        team: player.teamId,
        isHabilitado: player.isHabilitado,
        position: player.position,
      });

      const resp = await this.playerRepository.save(createdPlayer);
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

  async updatePlayer(id: number, palyer: any) {
    return await this.playerRepository.update({ id }, palyer);
  }

  async transferPlayerToTeam(playerId: number, newTeamId: number) {
    const apiResponse = new ApiResponse<Player>();

    try {
      const player = await this.playerRepository.findOne({
        where: { id: playerId },
        relations: ['team'],
      });

      if (!player) {
        return Object.assign(apiResponse, {
          data: null,
          httpCode: 404,
          message: 'Jugador no encontrado',
        });
      }

      const newTeam = await this.teamRepository.findOne({
        where: { id: newTeamId },
      });

      if (!newTeam) {
        return Object.assign(apiResponse, {
          data: null,
          httpCode: 404,
          message: 'Equipo destino no encontrado',
        });
      }

      player.team = newTeam;
      await this.playerRepository.save(player);

      return Object.assign(apiResponse, {
        data: player,
        httpCode: 200,
        message: 'Transferencia realizada con éxito',
      });
    } catch (error) {
      return Object.assign(apiResponse, {
        data: null,
        httpCode: 500,
        message: `Error al transferir el jugador: ${error.message}`,
      });
    }
  }

  async removeAllPlayersFromTeams() {
    // Actualiza todos los jugadores que tienen equipo asignado en una sola consulta
    const result = await this.playerRepository
      .createQueryBuilder()
      .update(Player)
      .set({ team: null })
      .where('teamId IS NOT NULL')
      .execute();

    return {
      message: `Se han removido ${result.affected} jugadores de sus equipos.`,
    };
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
        return Object.assign(apiResponse, {
          data: [],
          httpCode: HttpStatus.OK,
          message: 'No existen jugadores para ese equipo',
        });
      }

      return Object.assign(apiResponse, {
        data: players,
        httpCode: HttpStatus.OK,
        message: '',
      });
    } catch (error) {
      return Object.assign(apiResponse, {
        data: null,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error al cargar los jugadores: ${error.message}`,
      });
    }
  }

  async getPlayers() {
    const apiResponse = new ApiResponse<any[]>();

    try {
      const players = await this.playerRepository.find({
        relations: ['team'],
        order: { valoration: 'DESC' },
      });

      if (!players || players.length === 0) {
        return Object.assign(apiResponse, {
          data: null,
          httpCode: HttpStatus.OK,
          message: 'No existen jugadores registrados',
        });
      }

      // Mapea cada jugador para incluir el equipo y el logo del equipo
      const playersWithTeam = await Promise.all(
        players.map(async (player) => {
          let teamWithLogo: any = null;
          if (player.team) {
            const logo = await this._getImage(player.team.idLogo);
            teamWithLogo = {
              id: player.team.id,
              name: player.team.name,
              abreviatura: player.team.abreviatura,
              idLogo: player.team.idLogo,
              logo,
            };
          }
          return {
            id: player.id,
            name: player.name,
            lastName: player.lastName,
            valoration: player.valoration,
            photo: player.photo,
            isHabilitado: player.isHabilitado,
            position: player.position,
            team: teamWithLogo,
            fullName: player.name + player.lastName,
          };
        }),
      );

      return Object.assign(apiResponse, {
        data: playersWithTeam,
        httpCode: HttpStatus.OK,
        message: '',
      });
    } catch (error) {
      return Object.assign(apiResponse, {
        data: null,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error al cargar los jugadores: ${error.message}`,
      });
    }
  }

  async soFifa() {
    const browser = await puppeteer.launch({
      headless: 'shell',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    );

    await page.goto('https://sofifa.com/players', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Asegurarse que la tabla cargó
    await page.waitForSelector('.table tbody tr');

    console.log(await page.content());
    const players = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.table tbody tr'));

      return rows
        .map((row) => {
          const shortName = row
            .querySelector('td:nth-child(2) a')
            ?.textContent?.trim();
          const fullName = row
            .querySelector('td:nth-child(2) a')
            ?.getAttribute('data-tippy-content');
          const age = row
            .querySelector('td[data-col="ae"]')
            ?.textContent?.trim();
          const overall = row
            .querySelector('td[data-col="oa"] em')
            ?.textContent?.trim();
          const potential = row
            .querySelector('td[data-col="pt"] em')
            ?.textContent?.trim();
          const nationalityFlag = row
            .querySelector('td:nth-child(2) img.flag')
            ?.getAttribute('src');
          const position = row
            .querySelector('td:nth-child(2) .pos')
            ?.textContent?.trim();
          const club = row
            .querySelector('td:nth-child(6) a')
            ?.textContent?.trim();
          const value = row
            .querySelector('td[data-col="vl"]')
            ?.textContent?.trim();
          const wage = row
            .querySelector('td[data-col="wg"]')
            ?.textContent?.trim();
          const imgUrl = row
            .querySelector('img.player-check')
            ?.getAttribute('data-src');

          return {
            shortName,
            fullName,
            age,
            overall,
            potential,
            nationalityFlag: nationalityFlag
              ? 'https://sofifa.com' + nationalityFlag
              : null,
            position,
            club,
            value,
            wage,
            imgUrl,
          };
        })
        .filter((p) => p.fullName);
    });

    await browser.close();
    return players;
  }

  async _getImage(idLogo) {
    return await this.imageRepository.findOne({
      where: {
        id: idLogo,
      },
    });
  }
}
