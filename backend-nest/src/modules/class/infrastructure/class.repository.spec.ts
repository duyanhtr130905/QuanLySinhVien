import type { Pool } from 'pg';
import { PgErrorTranslator } from '../../../common/database/pg-error-translator';
import type { PgExecutor } from '../../../common/database/pg-executor.type';
import { ClassCodeConflictError } from '../application/ports/class-persistence.port';
import { ClassRepository } from './class.repository';
const executor = () => ({ query: jest.fn() }) as unknown as PgExecutor;
describe('ClassRepository', () => {
  it('uses active-student count, allowlisted columns, search/order/toplist, and parameters', async () => { const db = executor(); (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: '1' }] }).mockResolvedValueOnce({ rows: [{ count: '1' }] }).mockResolvedValueOnce({ rows: [{ id: '1', student_count: '2' }] }); const repo = new ClassRepository(db as unknown as Pool, new PgErrorTranslator()); await repo.findAllWithStudentCount('id,bad'); const page = await repo.findPageWithStudentCount({ page: 1, size: 5, search: 'A', order: 'co:1', columnlist: 'id,name', toplist: [7] }); expect(page.page_info).toEqual({ total_items: 1, total_pages: 1, current: 1, size: 5 }); expect(db.query).toHaveBeenNthCalledWith(1, expect.stringContaining('student."class_id" = "tra_class"."id"')); expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining('"code" ILIKE $1'), ['%A%']); expect(db.query).toHaveBeenNthCalledWith(3, expect.stringContaining('CASE WHEN "id" IN ($2)'), ['%A%', 7, 5, 0]); });
  it('keeps description null on create, never writes code on update, and translates errors', async () => { const db = executor(); (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: '1' }] }).mockResolvedValueOnce({ rows: [{ id: '1' }] }).mockRejectedValueOnce({ code: '23505', constraint: 'tra_class_code_key', message: 'duplicate' }); const repo = new ClassRepository(db as unknown as Pool, new PgErrorTranslator()); await repo.create({ code: 'C1', name: 'A', description: '' }); await repo.updateLegacy(1, { name: 'B' }); await expect(repo.findAllWithStudentCount()).rejects.toMatchObject({ name: 'ClassCodeConflictError' }); expect(db.query).toHaveBeenNthCalledWith(1, expect.any(String), ['C1', 'A', null]); expect(db.query).toHaveBeenNthCalledWith(2, expect.not.stringContaining('"code" ='), ['B', 1]); });
  it('translates copy insert unique races at the persistence boundary', async () => {
    const db = executor();
    (db.query as jest.Mock).mockRejectedValue({ code: '23505', constraint: 'tra_class_code_key', message: 'duplicate' });
    const repo = new ClassRepository(db as unknown as Pool, new PgErrorTranslator());
    await expect(repo.insertCopy({ code: 'C1-copy', name: 'A' })).rejects.toBeInstanceOf(ClassCodeConflictError);
    await expect(repo.insertCopyDrafts([{ draftKey: 'copy-1', sourceId: 1, values: { code: 'C1-copy', name: 'A' } }], db as unknown as never)).rejects.toBeInstanceOf(ClassCodeConflictError);
  });
});
