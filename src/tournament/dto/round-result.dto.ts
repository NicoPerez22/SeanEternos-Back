/** Tipos admitidos por match_events.eventType (ENUM en la base). */
export const MATCH_EVENT_TYPES = ['GOAL', 'YELLOW', 'RED', 'INJURY'] as const;
export type MatchEventType = (typeof MATCH_EVENT_TYPES)[number];

export const MAX_RESULT_EVENTS = 200;

export interface MatchResultEvent {
  teamId: number;
  playerId: number | null;
  eventType: MatchEventType;
  minute: number | null;
  /** Ausente = conservar las notas guardadas del evento. */
  notes?: string | null;
}

export interface UpdateMatchResultDto {
  roundId?: number;
  tournamentId: number;
  homeGoals: number;
  awayGoals: number;
  events: MatchResultEvent[];
}

type ParseResult =
  | { ok: true; value: UpdateMatchResultDto }
  | { ok: false; message: string };

function toInt(value: unknown): number | null {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return null;
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

/** Valida el body de PUT tournament/rounds/:roundId/result. */
export function parseMatchResult(body: any): ParseResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'El cuerpo de la solicitud es obligatorio' };
  }

  const tournamentId = toInt(body.tournamentId);
  if (tournamentId === null || tournamentId <= 0) {
    return { ok: false, message: 'tournamentId es obligatorio' };
  }

  let roundId: number | undefined;
  if (!isBlank(body.roundId)) {
    const parsed = toInt(body.roundId);
    if (parsed === null || parsed <= 0) {
      return { ok: false, message: 'roundId inválido' };
    }
    roundId = parsed;
  }

  const homeGoals = toInt(body.homeGoals);
  const awayGoals = toInt(body.awayGoals);
  if (
    homeGoals === null ||
    awayGoals === null ||
    homeGoals < 0 ||
    awayGoals < 0 ||
    homeGoals > 99 ||
    awayGoals > 99
  ) {
    return {
      ok: false,
      message: 'homeGoals y awayGoals deben ser enteros entre 0 y 99',
    };
  }

  const rawEvents = body.events ?? [];
  if (!Array.isArray(rawEvents)) {
    return { ok: false, message: 'events debe ser una lista' };
  }
  if (rawEvents.length > MAX_RESULT_EVENTS) {
    return {
      ok: false,
      message: `No se admiten más de ${MAX_RESULT_EVENTS} eventos`,
    };
  }

  const events: MatchResultEvent[] = [];
  for (const [index, raw] of rawEvents.entries()) {
    const position = `Evento ${index + 1}`;
    if (!raw || typeof raw !== 'object') {
      return { ok: false, message: `${position}: formato inválido` };
    }

    const eventType = String(raw.eventType ?? '')
      .trim()
      .toUpperCase();
    if (!(MATCH_EVENT_TYPES as readonly string[]).includes(eventType)) {
      return {
        ok: false,
        message: `${position}: tipo "${raw.eventType}" no admitido (${MATCH_EVENT_TYPES.join(', ')})`,
      };
    }

    const teamId = toInt(raw.teamId);
    if (teamId === null || teamId <= 0) {
      return { ok: false, message: `${position}: teamId es obligatorio` };
    }

    let playerId: number | null = null;
    if (!isBlank(raw.playerId)) {
      playerId = toInt(raw.playerId);
      if (playerId === null || playerId <= 0) {
        return { ok: false, message: `${position}: playerId inválido` };
      }
    }

    let minute: number | null = null;
    if (!isBlank(raw.minute)) {
      minute = toInt(raw.minute);
      if (minute === null || minute < 0 || minute > 200) {
        return { ok: false, message: `${position}: minuto inválido` };
      }
    }

    const event: MatchResultEvent = {
      teamId,
      playerId,
      eventType: eventType as MatchEventType,
      minute,
    };
    if (raw.notes !== undefined) {
      if (raw.notes !== null && typeof raw.notes !== 'string') {
        return { ok: false, message: `${position}: notes debe ser texto` };
      }
      if (typeof raw.notes === 'string' && raw.notes.length > 255) {
        return {
          ok: false,
          message: `${position}: notes admite hasta 255 caracteres`,
        };
      }
      event.notes = raw.notes;
    }
    events.push(event);
  }

  return {
    ok: true,
    value: { roundId, tournamentId, homeGoals, awayGoals, events },
  };
}
