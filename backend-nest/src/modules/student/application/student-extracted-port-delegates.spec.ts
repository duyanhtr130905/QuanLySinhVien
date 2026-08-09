import { StudentImportExportService } from './student-import-export.service';
import type { StudentImportExportPort } from '../domain/student-persistence.port';

const values = { code: 'SV1', fullname: 'One', dob: '01/01/2000', gender: 'Nam', class: 'C1', email: 'one@example.test', username: 'one', password: 'Valid1!x', hobbies: 'Music' };

const codecs = () => {
  const entries = new Map(['csv', 'xlsx', 'json', 'xml'].map((format) => [format, { encode: jest.fn(async (rows: Record<string, unknown>[]) => Buffer.from(JSON.stringify(rows))), parse: jest.fn(async () => [values]) }]));
  return { get: jest.fn((format: string) => entries.get(format)), entries };
};

const persistence = (): jest.Mocked<StudentImportExportPort> => ({
  findActiveById: jest.fn(),
  findActiveByIds: jest.fn(),
  findImportLookups: jest.fn().mockResolvedValue({ classes: [{ id: 1, code: 'C1' }], hobbies: [{ id: 1, name: 'Music', bit_value: 1 }] }),
  findActiveByUniqueValues: jest.fn().mockResolvedValue([]),
  commit: jest.fn(),
  commitSafe: jest.fn().mockResolvedValue({ created: [], updated: [] }),
});

describe('StudentImportExportService', () => {
  it('owns codec orchestration and export mapping while reading persistence facts', async () => {
    const port = persistence(); const files = codecs();
    port.findActiveById.mockResolvedValue({ id: 1, ...values, dob: '2000-01-01', sex: true, class_id: 1, hobbies: 1, homecity: null, address: null, description: null, hair_color: null, facebook: null });
    const service = new StudentImportExportService(port, files as never);
    const file = await service.exportOne(1, 'json');
    expect(JSON.parse(file.buffer.toString())[0]).toMatchObject({ code: 'SV1', dob: '01/01/2000', gender: 'Nam', class: 'C1', hobbies: 'Music', password: '' });
    expect(port.findActiveById).toHaveBeenCalledWith(1);
    expect(port.findImportLookups).toHaveBeenCalled();
  });

  it('parses, normalizes, validates, and determines create/update modes without writes', async () => {
    const port = persistence(); const files = codecs();
    port.findActiveByUniqueValues.mockResolvedValue([{ id: 9, code: 'SV1', fullname: 'Old', dob: null, sex: null, class_id: null, email: 'old@example.test', username: 'old', homecity: null, address: null, hobbies: 0, description: null, hair_color: null, facebook: null }]);
    const service = new StudentImportExportService(port, files as never);
    const result = await service.preview(Buffer.from('fixture'), 'students.csv');
    expect(result.rows[0]).toMatchObject({ status: 'valid', mode: 'update', values: { email: 'one@example.test', hobbies: ['Music'] } });
    expect(files.entries.get('csv')?.parse).toHaveBeenCalledWith(Buffer.from('fixture'));
    expect(port.commit).not.toHaveBeenCalled();
  });

  it('delegates only the existing commit path', async () => {
    const port = persistence(); const service = new StudentImportExportService(port, codecs() as never);
    await expect(service.commitSafe([])).resolves.toEqual({ created: [], updated: [] });
    expect(port.commitSafe).toHaveBeenCalledWith([]);
  });
});
