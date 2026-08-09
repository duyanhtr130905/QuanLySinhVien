import { StudentPostgresImportExportAdapter } from '../infrastructure/student-postgres-import-export.adapter';

const values = { code: 'SV1', fullname: 'One', dob: '01/01/2000', gender: 'Nam', class: 'C1', email: 'one@example.test', username: 'one', password: 'Valid1!x', hobbies: 'Music' };
const codecs = { get: jest.fn() };
const passwords = () => ({ hash: jest.fn(async (value: string) => `hash:${value}`) });

describe('StudentPostgresImportExportAdapter', () => {
  it('provides focused persistence reads with mapped records', async () => {
    const pool = { query: jest.fn()
      .mockResolvedValueOnce({ rows: [{ id: '1', code: 'SV1', fullname: 'One', dob: '2000-01-01', sex: true, class_id: '2', email: 'one@example.test', username: 'one', homecity: null, address: null, hobbies: '4', description: null, hair_color: null, facebook: null }] })
      .mockResolvedValueOnce({ rows: [{ id: 2, code: 'C1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 3, name: 'Music', bit_value: 4 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, code: 'SV1', fullname: 'One', dob: null, sex: null, class_id: null, email: 'one@example.test', username: 'one', homecity: null, address: null, hobbies: 0, description: null, hair_color: null, facebook: null }] }),
    };
    const adapter = new StudentPostgresImportExportAdapter(pool as never, {} as never, codecs as never, passwords() as never);
    await expect(adapter.findActiveById(1)).resolves.toMatchObject({ id: 1, class_id: 2, hobbies: 4, sex: true });
    await expect(adapter.findImportLookups()).resolves.toEqual({ classes: [{ id: 2, code: 'C1' }], hobbies: [{ id: 3, name: 'Music', bit_value: 4 }] });
    await expect(adapter.findActiveByUniqueValues({ code: ['SV1'], email: [], username: [] })).resolves.toHaveLength(1);
    expect(pool.query.mock.calls[3][1]).toEqual([['SV1'], [], []]);
  });

  it('keeps the existing commit update behavior intact', async () => {
    const client = { query: jest.fn()
      .mockResolvedValueOnce({ rows: [{ id: 1, code: 'C1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Music', bit_value: 4 }] })
      .mockResolvedValueOnce({ rows: [{ id: 9, code: 'SV1', email: 'one@example.test', username: 'one' }] })
      .mockResolvedValueOnce({ rows: [{ id: 9, code: 'SV1', password: 'old-hash' }] })
      .mockResolvedValueOnce({ rows: [{ id: 9, code: 'SV1' }] }),
    };
    const hasher = passwords(); const adapter = new StudentPostgresImportExportAdapter({} as never, { run: async <T>(work: (value: typeof client) => Promise<T>) => work(client) } as never, codecs as never, hasher as never);
    const result = await adapter.commit([{ draftKey: 'update', rowNumber: 2, values: { ...values, password: '', hobbies: 'Music' } }]);
    expect(result.updated).toHaveLength(1);
    expect(client.query.mock.calls[4][0]).not.toContain('"password"');
    expect(hasher.hash).not.toHaveBeenCalled();
  });
});
