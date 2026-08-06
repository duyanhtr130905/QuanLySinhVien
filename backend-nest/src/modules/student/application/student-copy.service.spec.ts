import { StudentCopyService } from './student-copy.service';

const storage = { upload: jest.fn(), delete: jest.fn(), getPublicUrl: jest.fn() };
const source = { id: 1, code: 'SV1', fullname: 'One', email: 'one@example.test', username: 'one', password: 'hash-from-source', attachment: 'shared://attachment', hobbies: 0 };
const draft = { draftKey: 'student-1', sourceId: 1, values: { code: 'SV1-copy', fullname: 'One', email: 'one-copy@example.test', username: 'one-copy', hobbies: 0, attachment: 'attacker://ignored', password: 'client-hash' } };

function transaction(client: { query: jest.Mock }) { return { run: jest.fn(async (work: (value: typeof client) => Promise<unknown>) => work(client)) }; }
function service(pool: { query: jest.Mock }, client = { query: jest.fn() }) { return { copies: new StudentCopyService(pool as never, transaction(client) as never, storage as never), client }; }

describe('StudentCopyService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('previews in two batch reads, de-duplicates source ids, and never exposes password', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce({ rows: [source] }).mockResolvedValueOnce({ rows: [] }) };
    const { copies } = service(pool);
    const result = await copies.preview([1, 1, 999]);
    expect(result).toMatchObject({ notFoundIds: [999], drafts: [{ draftKey: 'student-1', sourceId: 1, values: { attachment: 'shared://attachment' } }] });
    expect(JSON.stringify(result)).not.toMatch(/password|hash-from-source/i);
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(pool.query.mock.calls.map(([sql]) => sql).join('\n')).not.toMatch(/INSERT INTO|UPDATE "tra_student"|DELETE FROM/i);
  });

  it('makes preview candidates unique across a batch without N+1 queries', async () => {
    const second = { ...source, id: 2 };
    const pool = { query: jest.fn().mockResolvedValueOnce({ rows: [source, second] }).mockResolvedValueOnce({ rows: [] }) };
    const { copies } = service(pool);
    const result = await copies.preview([1, 2]);
    expect(result.drafts.map((item) => item.values.code)).toEqual(['SV1-copy', 'SV1-copy-2']);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('validates drafts with batch DB lookups and reports each conflict by draftKey', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce({ rows: [{ code: 'taken', username: 'taken-user', email: 'taken@example.test' }] }).mockResolvedValueOnce({ rows: [] }) };
    const { copies } = service(pool);
    const result = await copies.validate([
      { draftKey: 'a', sourceId: 1, values: { code: 'same', fullname: 'One', email: 'taken@example.test', username: 'same-user', class_id: 7 } },
      { draftKey: 'b', sourceId: 2, values: { code: 'same', fullname: 'Two', email: 'two@example.test', username: 'same-user', class_id: 7 } },
    ]);
    expect(result.rows).toEqual([
      expect.objectContaining({ draftKey: 'a', status: 'invalid', errors: expect.objectContaining({ code: expect.any(String), email: expect.any(String), username: expect.any(String), class_id: expect.any(String) }) }),
      expect.objectContaining({ draftKey: 'b', status: 'invalid', errors: expect.objectContaining({ code: expect.any(String), username: expect.any(String), class_id: expect.any(String) }) }),
    ]);
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(pool.query.mock.calls.map(([sql]) => sql).join('\n')).not.toMatch(/INSERT INTO|UPDATE "tra_student"|DELETE FROM/i);
  });

  it('keeps the source hash and attachment internally on commit while stripping client internals', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce({ rows: [{ mask: 0 }] }) };
    const client = { query: jest.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [source] }).mockResolvedValueOnce({ rows: [{ id: 9, code: 'SV1-copy', attachment: 'shared://attachment' }] }) };
    const { copies } = service(pool, client);
    const result = await copies.commit([draft]);
    expect(result).toEqual({ created: [{ draftKey: 'student-1', record: { id: 9, code: 'SV1-copy', attachment: 'shared://attachment' } }] });
    expect(JSON.stringify(result)).not.toMatch(/password|hash-from-source|client-hash/i);
    const insertArgs = client.query.mock.calls[2][1] as unknown[][];
    expect(insertArgs[11]).toEqual(['hash-from-source']);
    expect(insertArgs[14]).toEqual(['shared://attachment']);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('rechecks a deleted or missing source in the transaction before insert', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce({ rows: [{ mask: 0 }] }) };
    const client = { query: jest.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] }) };
    const { copies } = service(pool, client);
    await expect(copies.commit([draft])).rejects.toMatchObject({ code: 'H604' });
    expect(client.query.mock.calls.map(([sql]) => sql).join('\n')).not.toContain('INSERT INTO');
  });

  it('rejects a conflict created after preview without writing a partial batch', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce({ rows: [{ mask: 0 }] }) };
    const client = { query: jest.fn().mockResolvedValueOnce({ rows: [{ code: 'SV1-copy' }] }) };
    const { copies } = service(pool, client);
    await expect(copies.commit([draft])).rejects.toMatchObject({ code: 'H603' });
    expect(client.query.mock.calls.map(([sql]) => sql).join('\n')).not.toContain('INSERT INTO');
  });

  it('rejects duplicate draft keys and batch unique values before source or insert queries', async () => {
    const pool = { query: jest.fn().mockResolvedValueOnce({ rows: [{ mask: 0 }] }) };
    const client = { query: jest.fn() };
    const { copies } = service(pool, client);
    await expect(copies.commit([draft, { ...draft }])).rejects.toMatchObject({ code: 'H603' });
    expect(client.query).not.toHaveBeenCalled();
  });
});
