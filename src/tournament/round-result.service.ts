import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { callProcedureRows } from 'shared/database/stored-procedure';
import { ApiResponse } from 'shared/models/apiResponse';
import { parseMatchResult } from './dto/round-result.dto';

/** Error con el formato de ApiResponse (code -1) y el status HTTP real. */
export function resultError(status: number, message: string): HttpException {
  const body: ApiResponse<null> = {
    data: null,
    httpCode: status,
    message,
    code: -1,
  };
  return new HttpException(body, status);
}

function toHttpError(error: any, prefix: string): HttpException {
  if (error instanceof HttpException) return error;
  const driver = error?.driverError ?? error;
  const sqlMessage = driver?.sqlMessage ?? error?.sqlMessage;
  if (driver?.sqlState === '45000') {
    return resultError(HttpStatus.BAD_REQUEST, sqlMessage ?? prefix);
  }
  if (driver?.errno === 1452) {
    return resultError(
      HttpStatus.BAD_REQUEST,
      'Algún jugador o equipo de los eventos no existe',
    );
  }
  return resultError(
    HttpStatus.INTERNAL_SERVER_ERROR,
    `${prefix}: ${sqlMessage || error?.message}`,
  );
}

function mapEvent(row: any) {
  return {
    eventId: row.eventId,
    teamId: row.teamId,
    playerId: row.playerId ?? null,
    eventType: row.eventType,
    minute: row.minute ?? null,
    notes: row.notes ?? null,
    playerName: row.playerName ?? null,
    playerLastName: row.playerLastName ?? null,
  };
}

@Injectable()
export class RoundResultService {
  constructor(private readonly dataSource: DataSource) {}

  async getResult(roundId: number) {
    try {
      const [round] = await callProcedureRows(
        this.dataSource,
        'sp_ap_get_round_result',
        [roundId],
      );
      if (!round) {
        throw resultError(HttpStatus.NOT_FOUND, 'El partido no existe');
      }
      const events = await callProcedureRows(
        this.dataSource,
        'sp_ap_get_round_result_events',
        [roundId],
      );

      return {
        ...new ApiResponse<any>(),
        data: {
          roundId: round.roundId,
          tournamentId: round.tournamentId,
          homeTeamId: round.homeTeamId,
          awayTeamId: round.awayTeamId,
          homeGoals: round.homeGoals,
          awayGoals: round.awayGoals,
          state: round.state,
          isNullMatch: Number(round.isNullMatch) === 1,
          events: events.map(mapEvent),
        },
        httpCode: HttpStatus.OK,
        message: 'Resultado obtenido correctamente',
        code: 0,
      };
    } catch (error) {
      throw toHttpError(error, 'Error al obtener el resultado');
    }
  }

  /**
   * Reemplaza el resultado completo de un partido ya jugado. Las tarjetas,
   * sanciones, lesiones y estadísticas se recalculan en el mismo SP, dentro
   * de esta transacción.
   */
  async updateResult(roundId: number, body: any) {
    const parsed = parseMatchResult(body);
    if (!parsed.ok) {
      throw resultError(HttpStatus.BAD_REQUEST, parsed.message);
    }
    const dto = parsed.value;
    if (dto.roundId !== undefined && dto.roundId !== roundId) {
      throw resultError(
        HttpStatus.BAD_REQUEST,
        'El roundId del cuerpo no coincide con el de la URL',
      );
    }

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const [round] = await callProcedureRows(
        runner,
        'sp_ap_lock_round_for_result',
        [roundId],
      );
      this.assertEditable(round, dto);

      const [summary] = await callProcedureRows(
        runner,
        'sp_ap_replace_match_result',
        [roundId, dto.homeGoals, dto.awayGoals, JSON.stringify(dto.events)],
      );
      const events = await callProcedureRows(
        runner,
        'sp_ap_get_round_result_events',
        [roundId],
      );

      await runner.commitTransaction();

      return {
        ...new ApiResponse<any>(),
        data: {
          roundId,
          tournamentId: dto.tournamentId,
          homeGoals: dto.homeGoals,
          awayGoals: dto.awayGoals,
          events: events.map(mapEvent),
          changes: {
            eventsKept: Number(summary?.eventsKept ?? 0),
            eventsAdded: Number(summary?.eventsAdded ?? 0),
            eventsRemoved: Number(summary?.eventsRemoved ?? 0),
          },
        },
        httpCode: HttpStatus.OK,
        message: 'Resultado actualizado correctamente',
        code: 0,
      };
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw toHttpError(error, 'Error al editar el resultado');
    } finally {
      await runner.release();
    }
  }

  private assertEditable(
    round: any,
    dto: { tournamentId: number; events: { teamId: number }[] },
  ) {
    if (!round) {
      throw resultError(HttpStatus.NOT_FOUND, 'El partido no existe');
    }
    if (Number(round.tournamentId) !== dto.tournamentId) {
      throw resultError(
        HttpStatus.BAD_REQUEST,
        'El partido no pertenece a ese torneo',
      );
    }
    if (Number(round.state) !== 1) {
      throw resultError(
        HttpStatus.CONFLICT,
        'El partido está pendiente: cargá el reporte en lugar de editarlo',
      );
    }
    if (Number(round.isNullMatch) === 1) {
      throw resultError(
        HttpStatus.CONFLICT,
        'Los partidos nulos no se pueden editar',
      );
    }
    if (round.stage === 'KO' && Number(round.tieFinished) === 1) {
      throw resultError(
        HttpStatus.CONFLICT,
        'La llave ya está definida: editar el resultado no recalcularía al ganador',
      );
    }
    const teams = [Number(round.homeTeamId), Number(round.awayTeamId)];
    const foreign = dto.events.find((e) => !teams.includes(e.teamId));
    if (foreign) {
      throw resultError(
        HttpStatus.BAD_REQUEST,
        `El equipo ${foreign.teamId} no juega este partido`,
      );
    }
  }
}
