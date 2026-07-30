import type { Pool } from 'pg';
import { BasePgRepository, PgRepositoryMetadata } from './base-pg.repository';
import { PgExecutor } from './pg-executor.type';

type UserRow = { id: number; name: string; email: string };

const metadata: PgRepositoryMetadata = {
  tableName: 'users',
  primaryKey: 'id',
  selectableColumns: ['id', 'name', 'email'],
  insertableColumns: ['name', 'email'],
  updatableColumns: ['name'],
  searchableColumns: ['name', 'email'],
  sortableColumns: ['id', 'name'],
  defaultOrder: { column: 'id', direction: 'ASC' },
};

class UserRepository extends BasePgRepository<UserRow> {
  constructor(pool: Pool, repositoryMetadata = metadata) {
    super(pool, repositoryMetadata);
  }
}

const executor = () => ({ query: jest.fn() }) as unknown as PgExecutor;

describe('BasePgRepository', () => {
  it('uses parameterized values for findById and existsById', async () => {
    const db = executor();
    (db.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ id: 7, name: 'An', email: 'an@example.com' }] })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    const repository = new UserRepository(db as unknown as Pool);

    await expect(repository.findById('7')).resolves.toEqual({ id: 7, name: 'An', email: 'an@example.com' });
    await expect(repository.existsById('7')).resolves.toBe(true);

    expect(db.query).toHaveBeenNthCalledWith(1, expect.stringContaining('WHERE "id" = $1'), ['7']);
    expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining('WHERE "id" = $1'), ['7']);
  });

  it('paginates with parameterized search, limit, and offset', async () => {
    const db = executor();
    (db.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ count: 2 }] })
      .mockResolvedValueOnce({ rows: [{ id: 2, name: 'An', email: 'an@example.com' }] });
    const repository = new UserRepository(db as unknown as Pool);

    await expect(repository.paginate({ page: 2, size: 5, search: 'An', order: { column: 'name', direction: 'DESC' } }))
      .resolves.toEqual({
        page_info: { total_items: 2, total_pages: 1, current: 2, size: 5 },
        records: [{ id: 2, name: 'An', email: 'an@example.com' }],
      });

    expect(db.query).toHaveBeenNthCalledWith(1, expect.stringContaining('ILIKE $1'), ['%An%']);
    expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining('ORDER BY "name" DESC LIMIT $2 OFFSET $3'), ['%An%', 5, 5]);
  });

  it('rejects unsafe metadata and request-facing order columns', async () => {
    expect(() => new UserRepository(executor() as unknown as Pool, { ...metadata, tableName: 'users; DROP TABLE users' }))
      .toThrow('invalid SQL identifier');
    const repository = new UserRepository(executor() as unknown as Pool);

    await expect(repository.paginate({ page: 1, size: 10, order: { column: 'email', direction: 'ASC' } }))
      .rejects.toThrow('column is not sortable');
  });

  it('uses a transaction executor when provided instead of the injected pool', async () => {
    const pool = executor();
    const client = executor();
    (client.query as jest.Mock).mockResolvedValue({ rows: [] });
    const repository = new UserRepository(pool as unknown as Pool);

    await repository.findAll(client);

    expect(client.query).toHaveBeenCalledTimes(1);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('only writes allowlisted columns', async () => {
    const db = executor();
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ id: 1, name: 'An', email: 'an@example.com' }] });
    const repository = new UserRepository(db as unknown as Pool);

    await repository.insert({ name: 'An', email: 'an@example.com' });
    await repository.updateById(1, { name: 'Bình' });
    await expect(repository.insert({ password: 'not-allowed' })).rejects.toThrow('column is not writable');
    await expect(repository.updateById(1, { email: 'not-updatable' })).rejects.toThrow('column is not writable');

    expect(db.query).toHaveBeenNthCalledWith(1, expect.stringContaining('INSERT INTO "users" ("name", "email")'), ['An', 'an@example.com']);
    expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining('UPDATE "users" SET "name" = $1'), ['Bình', 1]);
  });
});
