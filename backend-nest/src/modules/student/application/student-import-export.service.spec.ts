import { StudentPostgresImportExportAdapter } from '../infrastructure/student-postgres-import-export.adapter';
import { StudentImportUniqueConflictError } from '../domain/student-persistence.port';

describe('StudentPostgresImportExportAdapter', () => {
  it('maps focused lookup rows and uses the transaction executor for mutations', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) }; const transaction = { query: jest.fn().mockResolvedValueOnce({ rows: [{ id: 9, code: 'SV1' }] }).mockResolvedValueOnce({ rows: [{ id: 9, code: 'SV1' }] }) };
    const adapter = new StudentPostgresImportExportAdapter(pool as never);
    await expect(adapter.lockActiveByCodes(['SV1'], transaction as never)).resolves.toEqual([{ id: 9, code: 'SV1' }]);
    await adapter.updateImport(9, { code: 'SV1', fullname: 'One', dob: null, sex: null, class_id: null, email: 'one@example.test', username: 'one', homecity: null, address: null, hobbies: 0, description: null, hair_color: null, facebook: null }, transaction as never);
    expect(pool.query).not.toHaveBeenCalled(); expect(transaction.query.mock.calls[1][0]).not.toContain('"password"');
  });

  it('translates PostgreSQL unique violations to a persistence-neutral failure', async () => {
    const adapter = new StudentPostgresImportExportAdapter({ query: jest.fn().mockRejectedValue({ code: '23505' }) } as never);
    await expect(adapter.insertImport({ code: 'SV1', fullname: 'One', dob: null, sex: null, class_id: null, email: 'one@example.test', username: 'one', password: 'hash', homecity: null, address: null, hobbies: 0, description: null, hair_color: null, facebook: null }, { query: jest.fn().mockRejectedValue({ code: '23505' }) } as never)).rejects.toBeInstanceOf(StudentImportUniqueConflictError);
  });
});
