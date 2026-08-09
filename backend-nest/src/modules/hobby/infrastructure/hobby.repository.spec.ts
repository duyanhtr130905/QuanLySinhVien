import type { Pool } from 'pg';
import { HobbyDuplicateError } from '../domain/hobby-persistence.port';
import { PgErrorTranslator } from '../../../common/database/pg-error-translator';
import type { PgExecutor } from '../../../common/database/pg-executor.type';
import { HobbyRepository } from './hobby.repository';

const createExecutor = () => ({ query: jest.fn() }) as unknown as PgExecutor;

describe('HobbyRepository', () => {
  const createRepository = (executor: PgExecutor) => new HobbyRepository(
    executor as unknown as Pool,
    new PgErrorTranslator(),
  );

  it('lists only active hobbies in ascending bit order and reads every allocated bit', async () => {
    const executor = createExecutor();
    (executor.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ id: 1, bit_value: 1 }] })
      .mockResolvedValueOnce({ rows: [{ bit_value: 1 }, { bit_value: 2 }] });
    const repository = createRepository(executor);

    await expect(repository.getActive()).resolves.toEqual([{ id: 1, bit_value: 1 }]);
    await expect(repository.getUsedBitValues()).resolves.toEqual([1, 2]);

    expect(executor.query).toHaveBeenNthCalledWith(1, expect.stringContaining('WHERE "is_active" = true'));
    expect(executor.query).toHaveBeenNthCalledWith(1, expect.stringContaining('ORDER BY "bit_value" ASC'));
    expect(executor.query).toHaveBeenNthCalledWith(2, 'SELECT "bit_value" FROM "tra_hobby"');
  });

  it('uses parameterized bitmask and advisory-lock queries through the supplied executor', async () => {
    const pool = createExecutor();
    const transaction = createExecutor();
    (transaction.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    const repository = createRepository(pool);

    await repository.lockBitAllocation(transaction);
    await expect(repository.isUsedByActiveStudent(4, transaction)).resolves.toBe(true);

    expect(transaction.query).toHaveBeenNthCalledWith(1, 'SELECT pg_advisory_xact_lock($1)', [418_042]);
    expect(transaction.query).toHaveBeenNthCalledWith(
      2,
      'SELECT 1 FROM "tra_student" WHERE ("hobbies" & $1) != 0 AND "deleted_at" IS NULL LIMIT 1',
      [4],
    );
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('uses BasePgRepository for parameterized inserts and hard deletes', async () => {
    const executor = createExecutor();
    (executor.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ id: 2, code: 'HB2', name: 'Bơi', bit_value: 2, is_active: true }] })
      .mockResolvedValueOnce({ rows: [{ id: 2, code: 'HB2', name: 'Bơi', bit_value: 2, is_active: true }] });
    const repository = createRepository(executor);

    await repository.insert({ code: 'HB2', name: 'Bơi', bit_value: 2, is_active: true });
    await repository.deleteById(2);

    expect(executor.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO "tra_hobby" ("code", "name", "bit_value", "is_active")'),
      ['HB2', 'Bơi', 2, true],
    );
    expect(executor.query).toHaveBeenNthCalledWith(2, expect.stringContaining('DELETE FROM "tra_hobby"'), [2]);
  });

  it('translates PostgreSQL errors instead of exposing raw driver errors', async () => {
    const executor = createExecutor();
    const rawError = { code: '23505', constraint: 'tra_hobby_name_key', message: 'duplicate key' };
    (executor.query as jest.Mock).mockRejectedValue(rawError);
    const repository = createRepository(executor);

    await expect(repository.getActive()).rejects.toMatchObject({
      name: HobbyDuplicateError.name,
      field: 'name',
    });
  });
});
