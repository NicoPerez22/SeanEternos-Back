import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import * as ts from 'typescript';
import {
  callProcedureRows,
  callProcedureCommand,
} from '../shared/database/stored-procedure';
import { TournamentService } from '../src/tournament/tournament.service';
import { PlayerService } from '../src/player/player.service';

const root = resolve(__dirname, '..');
const sql = readFileSync(join(root, 'sql/stored-procedures.sql'), 'utf8');
const definitions = new Map(
  [
    ...sql.matchAll(
      /CREATE PROCEDURE (\w+)\((.*?)\)\s*\nSQL SECURITY INVOKER\s*\nBEGIN\s*\n([\s\S]*?)\nEND\$\$/g,
    ),
  ].map((m) => [
    m[1],
    { arity: (m[2].match(/\bIN p_/g) ?? []).length, body: m[3] },
  ]),
);

describe('Stored procedure migration contract', () => {
  it('ships every migrated call with the matching parameter count and metadata', () => {
    const used = new Set<string>();
    function inspectDirectory(directory: string) {
      for (const file of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, file.name);
        if (file.isDirectory()) inspectDirectory(path);
        else if (file.name.endsWith('.ts') && !file.name.endsWith('.spec.ts')) {
          const source = ts.createSourceFile(
            path,
            readFileSync(path, 'utf8'),
            ts.ScriptTarget.Latest,
            true,
          );
          function inspect(node: ts.Node) {
            if (
              ts.isCallExpression(node) &&
              ts.isIdentifier(node.expression) &&
              ['callProcedureRows', 'callProcedureCommand'].includes(
                node.expression.text,
              )
            ) {
              const name = (node.arguments[1] as ts.StringLiteral).text;
              const definition = definitions.get(name);
              expect(definition).toBeDefined();
              const args = node.arguments[2];
              expect(
                args && ts.isArrayLiteralExpression(args)
                  ? args.elements.length
                  : 0,
              ).toBe(definition?.arity);
              if (node.expression.text === 'callProcedureCommand') {
                expect(definition?.body).toContain(
                  'ROW_COUNT() AS affectedRows',
                );
              }
              used.add(name);
            }
            if (
              ts.isCallExpression(node) &&
              ts.isPropertyAccessExpression(node.expression)
            ) {
              expect(node.expression.name.text).not.toBe('createQueryBuilder');
              if (node.expression.name.text === 'query') {
                const arg = node.arguments[0];
                expect(ts.isStringLiteralLike(arg)).toBe(true);
                expect((arg as ts.StringLiteral).text).toMatch(/^CALL \w+\(/i);
              }
            }
            ts.forEachChild(node, inspect);
          }
          inspect(source);
        }
      }
    }
    inspectDirectory(join(root, 'src'));
    expect([...used].sort()).toEqual([...definitions.keys()].sort());
    expect(used.size).toBe(50);
    expect(sql).not.toMatch(/\$\{|\?/);
    expect(sql.replace(/^--.*$/gm, '')).not.toMatch(
      /\b(?:COMMIT|ROLLBACK|START TRANSACTION)\b/i,
    );
  });
});

describe('CALL result handling', () => {
  it('returns only rows, including an empty result set, and binds values', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([[{ id: 2 }], { affectedRows: 0 }])
      .mockResolvedValueOnce([[], {}]);
    const value = "'; DROP TABLE teams; --";
    await expect(
      callProcedureRows({ query }, 'sp_ap_find_tournament', [value]),
    ).resolves.toEqual([{ id: 2 }]);
    expect(query).toHaveBeenCalledWith('CALL sp_ap_find_tournament(?)', [
      value,
    ]);
    await expect(
      callProcedureRows({ query }, 'sp_ap_get_draft_pool'),
    ).resolves.toEqual([]);
  });

  it('uses explicit write metadata and ignores the CALL completion packet', async () => {
    const query = jest
      .fn()
      .mockResolvedValue([
        [{ affectedRows: '1', insertId: '42' }],
        { affectedRows: 0 },
      ]);
    await expect(
      callProcedureCommand({ query }, 'sp_ap_create_season_week', [
        1,
        2,
        '2026-11-01',
        '2026-11-07',
      ]),
    ).resolves.toEqual({ affectedRows: 1, insertId: 42 });
    query.mockResolvedValue([[{ affectedRows: 0 }], {}]);
    await expect(
      callProcedureCommand({ query }, 'sp_ap_delete_season_week', [99]),
    ).resolves.toEqual({ affectedRows: 0 });
  });

  it('rejects invalid names, missing result sets and missing write metadata', async () => {
    const query = jest.fn().mockResolvedValue({ affectedRows: 1 });
    await expect(
      callProcedureRows({ query }, 'sp_ap_x(); DROP TABLE teams'),
    ).rejects.toThrow('Invalid');
    expect(query).not.toHaveBeenCalled();
    await expect(
      callProcedureRows({ query }, 'sp_ap_find_tournament'),
    ).rejects.toThrow('result set');
    query.mockResolvedValue([[], {}]);
    await expect(
      callProcedureCommand({ query }, 'sp_ap_delete_season_week'),
    ).rejects.toThrow('write metadata');
  });
});

function makeTournament(query: jest.Mock) {
  const runner = {
    query,
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
  };
  const dataSource = { query: jest.fn(), createQueryRunner: () => runner };
  const service = new TournamentService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    dataSource as any,
    {} as any,
  );
  return { service, runner, dataSource };
}

describe('API procedure integration', () => {
  it('creates a week on the transaction connection and preserves its generated id', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([[{ id: 1 }], {}])
      .mockResolvedValueOnce([[], {}])
      .mockResolvedValueOnce([[{ affectedRows: 1, insertId: 42 }], {}]);
    const { service, runner, dataSource } = makeTournament(query);
    const result = await service.createWeek({
      seasonId: 1,
      weekNumber: 2,
      startDate: '2026-11-01',
      endDate: '2026-11-07',
    });
    expect(result).toMatchObject({ httpCode: 201, data: { id: 42 } });
    expect(query).toHaveBeenLastCalledWith(
      'CALL sp_ap_create_season_week(?, ?, ?, ?)',
      [1, 2, '2026-11-01', '2026-11-07'],
    );
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(runner.release).toHaveBeenCalledTimes(1);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('rolls back and releases the transaction when a procedure fails', async () => {
    const query = jest.fn().mockRejectedValue(new Error('FK constraint'));
    const { service, runner } = makeTournament(query);
    const result = await service.createWeek({ seasonId: 1 });
    expect(result).toMatchObject({ httpCode: 500, message: 'FK constraint' });
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(runner.commitTransaction).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it('does not report a tournament deletion when its affected count is zero', async () => {
    const query = jest.fn().mockResolvedValue([[{ affectedRows: 1 }], {}]);
    query.mockResolvedValueOnce([[{ id: 5 }], {}]);
    query.mockImplementation(async (statement: string) =>
      statement === 'CALL sp_ap_find_tournament(?)'
        ? [[{ id: 5 }], {}]
        : [
            [
              {
                affectedRows:
                  statement === 'CALL sp_ap_delete_tournament(?)' ? 0 : 1,
              },
            ],
            {},
          ],
    );
    const { service, runner } = makeTournament(query);
    await expect(service.removeTournament(5)).rejects.toThrow(
      'No se pudo eliminar el torneo',
    );
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(runner.commitTransaction).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it('sends draft assignments as JSON in chunks on the same connection', async () => {
    const query = jest.fn().mockResolvedValue([[{ affectedRows: 1 }], {}]);
    const { service, runner } = makeTournament(query);
    const assignments = Array.from({ length: 701 }, (_, id) => ({
      playerId: id + 1,
      teamId: 2,
    }));
    await (service as any).persistAssignments(runner, assignments);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]).toEqual([
      'CALL sp_ap_persist_draft_assignments(?)',
      [JSON.stringify(assignments.slice(0, 700))],
    ]);
    expect(query.mock.calls[1]).toEqual([
      'CALL sp_ap_persist_draft_assignments(?)',
      [JSON.stringify(assignments.slice(700))],
    ]);
    await (service as any).insertDraftLog(runner, 5, assignments);
    expect(query).toHaveBeenLastCalledWith(
      'CALL sp_ap_insert_draft_log(?, ?)',
      [5, JSON.stringify(assignments)],
    );
  });

  it('keeps optional tournament filtering parameterized', async () => {
    const query = jest.fn().mockResolvedValue([[], {}]);
    const service = new TournamentService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { query } as any,
      {} as any,
    );
    expect((await service.getRoundsByTeamId(2)).data).toEqual([]);
    expect(query).toHaveBeenLastCalledWith(
      'CALL sp_ap_get_rounds_by_team(?, ?)',
      [2, null],
    );
    await service.getRoundsByTeamId(2, 4);
    expect(query).toHaveBeenLastCalledWith(
      'CALL sp_ap_get_rounds_by_team(?, ?)',
      [2, 4],
    );
  });

  it('preserves offer JSON arrays, totals, pagination and pending filters', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([[{ total: 21 }], {}])
      .mockResolvedValueOnce([
        [{ id: 3, targetPlayers: '[{"id":8}]', offeredPlayers: '[]' }],
        {},
      ]);
    const service = new PlayerService(
      {} as any,
      {} as any,
      {} as any,
      { query } as any,
    );
    const result = await service.listPending(2, 20);
    expect(query.mock.calls).toEqual([
      ['CALL sp_ap_count_transfer_offers(?, ?)', [null, 'pending']],
      [
        'CALL sp_ap_list_transfer_offers(?, ?, ?, ?)',
        [null, 'pending', 20, 20],
      ],
    ]);
    expect(result).toMatchObject({
      data: [{ id: 3, targetPlayers: [{ id: 8 }], offeredPlayers: [] }],
      meta: { total: 21, totalPages: 2, page: 2 },
    });
  });
});
