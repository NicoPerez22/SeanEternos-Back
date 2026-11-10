import { HttpException } from '@nestjs/common';
import { parseMatchResult } from './dto/round-result.dto';
import { RoundResultService } from './round-result.service';
import { TournamentController } from './tournament.controller';

const playedRound = {
  roundId: 798,
  tournamentId: 31,
  homeTeamId: 12,
  awayTeamId: 14,
  homeGoals: 1,
  awayGoals: 1,
  state: 1,
  isNullMatch: 0,
  stage: 'GROUP',
  tieFinished: 0,
};

const body = {
  roundId: 798,
  tournamentId: 31,
  homeGoals: 1,
  awayGoals: 4,
  events: [
    { teamId: 12, playerId: 55, eventType: 'GOAL', minute: null },
    { teamId: 14, playerId: 70, eventType: 'RED', minute: null, notes: null },
  ],
};

function setup(round: any = playedRound, replaceError?: any) {
  const calls: string[] = [];
  const query = jest.fn(async (sql: string) => {
    calls.push(sql);
    if (sql.startsWith('CALL sp_ap_lock_round_for_result')) {
      return [round ? [round] : [], {}];
    }
    if (sql.startsWith('CALL sp_ap_replace_match_result')) {
      if (replaceError) throw replaceError;
      return [
        [{ reportId: 5, eventsKept: 1, eventsAdded: 1, eventsRemoved: 2 }],
        {},
      ];
    }
    if (sql.startsWith('CALL sp_ap_get_round_result_events')) {
      return [
        [
          {
            eventId: 9,
            teamId: 12,
            playerId: 55,
            eventType: 'GOAL',
            minute: null,
            notes: null,
            playerName: 'Juan',
            playerLastName: 'Pérez',
          },
        ],
        {},
      ];
    }
    throw new Error('Unexpected query ' + sql);
  });
  const runner: any = {
    isTransactionActive: false,
    query,
    connect: jest.fn(),
    startTransaction: jest.fn(async () => (runner.isTransactionActive = true)),
    commitTransaction: jest.fn(
      async () => (runner.isTransactionActive = false),
    ),
    rollbackTransaction: jest.fn(
      async () => (runner.isTransactionActive = false),
    ),
    release: jest.fn(),
  };
  const dataSource: any = { createQueryRunner: () => runner, query };
  return { service: new RoundResultService(dataSource), runner, calls };
}

async function expectApiError(promise: Promise<unknown>, status: number) {
  const error: any = await promise.catch((e) => e);
  expect(error).toBeInstanceOf(HttpException);
  expect(error.getStatus()).toBe(status);
  expect(error.getResponse()).toEqual(
    expect.objectContaining({ httpCode: status, code: -1, data: null }),
  );
  return error;
}

describe('parseMatchResult', () => {
  it('normalizes types and keeps notes only when they were sent', () => {
    const result = parseMatchResult({
      tournamentId: '31',
      homeGoals: 0,
      awayGoals: '2',
      events: [
        { teamId: 14, playerId: '', eventType: 'goal', minute: '' },
        { teamId: 14, playerId: 8, eventType: 'YELLOW', notes: 'Protesta' },
      ],
    });
    expect(result).toEqual({
      ok: true,
      value: {
        roundId: undefined,
        tournamentId: 31,
        homeGoals: 0,
        awayGoals: 2,
        events: [
          { teamId: 14, playerId: null, eventType: 'GOAL', minute: null },
          {
            teamId: 14,
            playerId: 8,
            eventType: 'YELLOW',
            minute: null,
            notes: 'Protesta',
          },
        ],
      },
    });
  });

  it.each([
    [{ ...body, events: [{ teamId: 12, eventType: 'SUB' }] }, 'no admitido'],
    [{ ...body, homeGoals: -1 }, 'homeGoals'],
    [{ ...body, tournamentId: undefined }, 'tournamentId'],
    [{ ...body, events: [{ eventType: 'GOAL' }] }, 'teamId'],
    [{ ...body, events: 'x' }, 'lista'],
  ])('rejects invalid bodies (%#)', (input, message) => {
    const result = parseMatchResult(input);
    expect(result.ok).toBe(false);
    expect((result as any).message).toContain(message);
  });
});

describe('RoundResultService.updateResult', () => {
  it('replaces the result inside one transaction and returns the saved events', async () => {
    const { service, runner, calls } = setup();
    const response = await service.updateResult(798, body);

    expect(calls.map((sql) => sql.split('(')[0])).toEqual([
      'CALL sp_ap_lock_round_for_result',
      'CALL sp_ap_replace_match_result',
      'CALL sp_ap_get_round_result_events',
    ]);
    expect(runner.query).toHaveBeenNthCalledWith(
      2,
      'CALL sp_ap_replace_match_result(?, ?, ?, ?)',
      [798, 1, 4, JSON.stringify(body.events)],
    );
    expect(runner.commitTransaction).toHaveBeenCalled();
    expect(runner.rollbackTransaction).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
    expect(response).toEqual(
      expect.objectContaining({
        httpCode: 200,
        code: 0,
        data: expect.objectContaining({
          homeGoals: 1,
          awayGoals: 4,
          changes: { eventsKept: 1, eventsAdded: 1, eventsRemoved: 2 },
          events: [expect.objectContaining({ playerLastName: 'Pérez' })],
        }),
      }),
    );
  });

  it.each([
    ['missing round', null, 404],
    ['pending round', { ...playedRound, state: 0 }, 409],
    ['null match', { ...playedRound, isNullMatch: 1 }, 409],
    ['decided KO tie', { ...playedRound, stage: 'KO', tieFinished: 1 }, 409],
    ['other tournament', { ...playedRound, tournamentId: 2 }, 400],
    ['team outside the match', { ...playedRound, awayTeamId: 99 }, 400],
  ])('rolls back without writing for a %s', async (_label, round, status) => {
    const { service, runner, calls } = setup(round);
    await expectApiError(service.updateResult(798, body), status);
    expect(calls).toHaveLength(1);
    expect(runner.rollbackTransaction).toHaveBeenCalled();
    expect(runner.commitTransaction).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
  });

  it('rejects a body for another round before opening a transaction', async () => {
    const { service, runner } = setup();
    await expectApiError(service.updateResult(1, body), 400);
    expect(runner.connect).not.toHaveBeenCalled();
  });

  it('maps validation errors raised by the procedure to 400', async () => {
    const signal = Object.assign(new Error('x'), {
      sqlState: '45000',
      sqlMessage: 'Hay eventos con tipo o equipo invalido para este partido',
    });
    const { service, runner } = setup(playedRound, signal);
    const error = await expectApiError(service.updateResult(798, body), 400);
    expect(error.getResponse().message).toContain('invalido');
    expect(runner.rollbackTransaction).toHaveBeenCalled();
  });

  it('reports unexpected database errors as 500 and rolls back', async () => {
    const { service, runner } = setup(playedRound, new Error('Deadlock'));
    await expectApiError(service.updateResult(798, body), 500);
    expect(runner.rollbackTransaction).toHaveBeenCalled();
  });
});

describe('TournamentController round result', () => {
  it('only lets administrators edit results', async () => {
    const results = { updateResult: jest.fn() };
    const users = { findOneByEmail: jest.fn().mockResolvedValue({ idRol: 2 }) };
    const controller = new TournamentController(
      {} as any,
      results as any,
      users as any,
    );
    await expectApiError(
      controller.updateRoundResult(798, body, {
        user: { email: 'user@example.test' },
      }),
      403,
    );
    expect(results.updateResult).not.toHaveBeenCalled();
  });

  it('checks the role in the database and delegates for admins', async () => {
    const results = { updateResult: jest.fn().mockResolvedValue({ ok: 1 }) };
    const users = {
      findOneByEmail: jest.fn().mockResolvedValue({ idRol: '1' }),
    };
    const controller = new TournamentController(
      {} as any,
      results as any,
      users as any,
    );
    await controller.updateRoundResult(798, body, {
      user: { email: 'admin@example.test' },
    });
    expect(users.findOneByEmail).toHaveBeenCalledWith('admin@example.test');
    expect(results.updateResult).toHaveBeenCalledWith(798, body);
  });
});
