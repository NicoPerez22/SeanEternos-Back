import { DataSource } from 'typeorm';

/** Reuse the DataSource, EntityManager or QueryRunner that owns the transaction. */
type QueryExecutor = Pick<DataSource, 'query'>;

export async function callProcedureRows<T = any>(
  executor: QueryExecutor,
  procedure: string,
  parameters: any[] = [],
): Promise<T[]> {
  if (!/^sp_ap_[a-z0-9_]+$/.test(procedure)) {
    throw new Error('Invalid stored procedure name');
  }
  const placeholders = parameters.map(() => '?').join(', ');
  const result = await executor.query(
    'CALL ' + procedure + '(' + placeholders + ')',
    parameters,
  );
  const rows = result?.[0];
  if (!Array.isArray(rows)) {
    throw new Error(
      'Stored procedure ' + procedure + ' did not return a result set',
    );
  }
  return rows;
}

/** Writes return explicit metadata instead of relying on CALL's trailing packet. */
export async function callProcedureCommand(
  executor: QueryExecutor,
  procedure: string,
  parameters: any[] = [],
): Promise<{ affectedRows: number; insertId?: number }> {
  const rows = await callProcedureRows<{
    affectedRows: number;
    insertId?: number;
  }>(executor, procedure, parameters);
  const row = rows[0];
  if (!row || row.affectedRows == null) {
    throw new Error(
      'Stored procedure ' + procedure + ' did not return write metadata',
    );
  }
  return {
    affectedRows: Number(row.affectedRows),
    ...(row.insertId == null ? {} : { insertId: Number(row.insertId) }),
  };
}
