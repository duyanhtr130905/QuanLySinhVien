import type { Pool, PoolClient } from 'pg';
import { PgTransactionManager } from './pg-transaction-manager';

describe('PgTransactionManager', () => {
  const createClient = () => ({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  }) as unknown as PoolClient;

  it('runs BEGIN, callback, COMMIT, and release with the checked-out client', async () => {
    const client = createClient();
    const pool = { connect: jest.fn().mockResolvedValue(client) } as unknown as Pool;
    const manager = new PgTransactionManager(pool);
    const work = jest.fn().mockResolvedValue('done');

    await expect(manager.run(work)).resolves.toBe('done');

    expect(pool.connect).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledWith(client);
    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(2, 'COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back, releases, and rethrows the original callback error', async () => {
    const client = createClient();
    const pool = { connect: jest.fn().mockResolvedValue(client) } as unknown as Pool;
    const manager = new PgTransactionManager(pool);
    const expected = new Error('work failed');

    await expect(manager.run(async () => { throw expected; })).rejects.toBe(expected);

    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(2, 'ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
