import { StudentCopyService } from './student-copy.service';
import type { StudentCopyPersistencePort } from '../domain/student-persistence.port';

const source = { id: 1, code: 'SV1', fullname: 'One', dob: null, sex: null, homecity: null, address: null, hair_color: null, email: 'one@example.test', facebook: null, class_id: null, username: 'one', password: 'hash-from-source', description: null, hobbies: 0, attachment: 'shared://attachment' };
const draft = { draftKey: 'student-1', sourceId: 1, values: { code: 'SV1-copy', fullname: 'One', email: 'one-copy@example.test', username: 'one-copy', hobbies: 0, attachment: 'attacker://ignored', password: 'client-hash' } };

function setup(overrides: Partial<StudentCopyPersistencePort> = {}) {
  const copies: jest.Mocked<StudentCopyPersistencePort> = {
    findActiveSources: jest.fn(), findOccupiedUniqueValues: jest.fn().mockResolvedValue({ code: [], username: [], email: [] }), findExistingClassIds: jest.fn().mockResolvedValue([]), lockActiveSources: jest.fn(), insertCopies: jest.fn(), ...overrides,
  };
  const transactions = { run: jest.fn(async (work) => work({})) };
  const students = { activeHobbyMask: jest.fn().mockResolvedValue(0) };
  const storage = { upload: jest.fn(), delete: jest.fn(), getPublicUrl: jest.fn() };
  return { service: new StudentCopyService(copies, transactions, students as never, storage as never), copies, transactions, students, storage };
}

describe('StudentCopyService', () => {
  it('owns batched preview candidates and never exposes source passwords', async () => {
    const second = { ...source, id: 2 };
    const { service, copies } = setup({ findActiveSources: jest.fn().mockResolvedValue([source, second]) });
    const result = await service.preview([1, 2, 999]);
    expect(result).toMatchObject({ notFoundIds: [999], drafts: [{ draftKey: 'student-1', values: { code: 'SV1-copy', attachment: 'shared://attachment' } }, { draftKey: 'student-2', values: { code: 'SV1-copy-2' } }] });
    expect(JSON.stringify(result)).not.toMatch(/password|hash-from-source/i);
    expect(copies.findActiveSources).toHaveBeenCalledWith([1, 2, 999]);
    expect(copies.findOccupiedUniqueValues).toHaveBeenCalledTimes(1);
  });

  it('owns validation rules and uses focused batched persistence lookups', async () => {
    const { service, copies } = setup({ findOccupiedUniqueValues: jest.fn().mockResolvedValue({ code: ['taken'], username: [], email: ['taken@example.test'] }), findExistingClassIds: jest.fn().mockResolvedValue([]) });
    const result = await service.validate([{ draftKey: 'a', sourceId: 1, values: { code: 'taken', fullname: 'One', email: 'taken@example.test', username: 'user', class_id: 7 } }]);
    expect(result.rows[0]).toEqual(expect.objectContaining({ draftKey: 'a', status: 'invalid', errors: expect.objectContaining({ code: expect.any(String), email: expect.any(String), class_id: expect.any(String) }) }));
    expect(copies.findOccupiedUniqueValues).toHaveBeenCalledTimes(1);
    expect(copies.findExistingClassIds).toHaveBeenCalledWith([7]);
  });

  it('orchestrates commit transaction, source lock, and internal password/attachment inheritance', async () => {
    const { service, copies } = setup({ lockActiveSources: jest.fn().mockResolvedValue([source]), insertCopies: jest.fn().mockResolvedValue([{ id: 9, code: 'SV1-copy', attachment: 'shared://attachment' }]) });
    const result = await service.commit([draft]);
    expect(result).toEqual({ created: [{ draftKey: 'student-1', record: { id: 9, code: 'SV1-copy', attachment: 'shared://attachment' } }] });
    expect(copies.lockActiveSources).toHaveBeenCalledWith([1], expect.anything());
    expect(copies.insertCopies).toHaveBeenCalledWith([expect.objectContaining({ password: 'hash-from-source', attachment: 'shared://attachment' })], expect.anything());
    expect(JSON.stringify(result)).not.toMatch(/password|hash-from-source|client-hash/i);
  });

  it('compensates uploaded attachments when the transaction rejects a late conflict', async () => {
    const { service, copies, storage } = setup({ findOccupiedUniqueValues: jest.fn().mockResolvedValue({ code: ['SV1-copy'], username: [], email: [] }) });
    storage.getPublicUrl.mockReturnValue('new://attachment');
    await expect(service.commit([draft], [{ fieldname: 'attachment-student-1', mimetype: 'image/png', size: 10, buffer: Buffer.from('x'), originalname: 'x.png' }])).rejects.toMatchObject({ code: 'H603' });
    expect(storage.delete).toHaveBeenCalledWith('new://attachment');
    expect(copies.lockActiveSources).not.toHaveBeenCalled();
  });
});
