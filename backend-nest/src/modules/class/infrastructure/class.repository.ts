import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { BasePgRepository, type PgRepositoryMetadata } from '../../../common/database/base-pg.repository';
import { PG_POOL } from '../../../common/database/database.tokens';
import { PgErrorTranslator } from '../../../common/database/pg-error-translator';
import type { PgExecutor } from '../../../common/database/pg-executor.type';
import type { ClassPageQuery, CopyDraft, CreateClassInput, UpdateClassInput } from '../application/class.contracts';
import type { StudentClass } from '../domain/student-class.entity';
import type { StudentSummary } from '../domain/student-summary.entity';
import { ClassCodeConflictError, ClassDeleteBlockedError } from '../application/ports/class-persistence.port';
import { ForeignKeyViolationError, UniqueConstraintViolationError } from '../../../common/database/errors/database-infrastructure.error';

const columns = ['id', 'code', 'name', 'description', 'created_at', 'updated_at'] as const;
const metadata: PgRepositoryMetadata = { tableName: 'tra_class', primaryKey: 'id', selectableColumns: columns, insertableColumns: ['code', 'name', 'description'], updatableColumns: ['name', 'description'], searchableColumns: ['code', 'name', 'description'], sortableColumns: columns, defaultOrder: { column: 'id', direction: 'ASC' } };
const aliases: Record<string, string> = { id: 'id', co: 'code', na: 'name', de: 'description', ca: 'created_at', ua: 'updated_at' };
const countSelect = '(SELECT COUNT(*) FROM "tra_student" student WHERE student."class_id" = "tra_class"."id" AND student."deleted_at" IS NULL) AS student_count';

@Injectable()
export class ClassRepository extends BasePgRepository<StudentClass> {
  constructor(@Inject(PG_POOL) pool: Pool, private readonly errors: PgErrorTranslator) { super(pool, metadata); }

  async findAllWithStudentCount(columnlist?: string, executor: PgExecutor = this.pool): Promise<StudentClass[]> {
    return this.translate(async () => (await executor.query(`SELECT ${this.selectColumns(columnlist)}, ${countSelect} FROM "tra_class" ORDER BY "id" ASC`)).rows as StudentClass[]);
  }

  async findPageWithStudentCount(query: ClassPageQuery, executor: PgExecutor = this.pool): Promise<{ page_info: { total_items: number; total_pages: number; current: number; size: number }; records: StudentClass[] }> {
    return this.translate(async () => {
      const values: unknown[] = [];
      const conditions: string[] = [];
      if (query.search) { values.push(`%${query.search}%`); conditions.push(`("code" ILIKE $${values.length} OR "name" ILIKE $${values.length} OR "description" ILIKE $${values.length})`); }
      const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
      const count = await executor.query(`SELECT COUNT(*) FROM "tra_class"${where}`, [...values]);
      const order = this.orderBy(query.order);
      let pinned = '';
      if (query.toplist.length) { const placeholders = query.toplist.map((_, index) => `$${values.length + index + 1}`).join(', '); values.push(...query.toplist); pinned = `CASE WHEN "id" IN (${placeholders}) THEN 0 ELSE 1 END, `; }
      values.push(query.size, (query.page - 1) * query.size);
      const data = await executor.query(`SELECT ${this.selectColumns(query.columnlist)}, ${countSelect} FROM "tra_class"${where} ORDER BY ${pinned}${order} LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
      const total = Number.parseInt(String(count.rows[0]?.count ?? 0), 10);
      return { page_info: { total_items: total, total_pages: Math.ceil(total / query.size), current: query.page, size: query.size }, records: data.rows as StudentClass[] };
    });
  }

  async findByIdWithStudentCount(id: unknown, executor: PgExecutor = this.pool): Promise<StudentClass | null> {
    return this.translate(async () => ((await executor.query(`SELECT ${columns.map((column) => `"${column}"`).join(', ')}, ${countSelect} FROM "tra_class" WHERE "id" = $1`, [id])).rows[0] as StudentClass | undefined) ?? null);
  }

  async create(input: CreateClassInput, executor: PgExecutor = this.pool): Promise<{ id: string }> {
    return this.translate(async () => ({ id: (await executor.query('INSERT INTO "tra_class" ("code", "name", "description", "created_at", "updated_at") VALUES ($1, $2, $3, NOW(), NOW()) RETURNING "id"', [input.code, input.name, input.description || null])).rows[0].id }));
  }

  async updateLegacy(id: number, input: UpdateClassInput, executor: PgExecutor = this.pool): Promise<{ id: string } | null> {
    return this.translate(async () => {
      const values: unknown[] = []; const set: string[] = [];
      if (input.name !== undefined) { values.push(input.name); set.push(`"name" = $${values.length}`); }
      if (input.description !== undefined) { values.push(input.description); set.push(`"description" = $${values.length}`); }
      set.push('"updated_at" = NOW()'); values.push(id);
      const result = await executor.query(`UPDATE "tra_class" SET ${set.join(', ')} WHERE "id" = $${values.length} RETURNING "id"`, values);
      return result.rows[0] ? { id: result.rows[0].id } : null;
    });
  }

  override async existsById(id: unknown, executor: PgExecutor = this.pool): Promise<boolean> { return this.translate(() => super.existsById(id, executor)); }
  override async deleteById(id: unknown, executor: PgExecutor = this.pool): Promise<StudentClass | null> { return this.translate(() => super.deleteById(id, executor)); }

  async deleteManyPartial(ids: unknown[], executor: PgExecutor = this.pool): Promise<{ deletedIds: unknown[]; blockedIds: unknown[] }> {
    const deletedIds: unknown[] = []; const blockedIds: unknown[] = [];
    for (const id of ids) {
      try { const deleted = await this.deleteById(id, executor); if (deleted) deletedIds.push(deleted.id); }
      catch (error) { if (error instanceof ClassDeleteBlockedError) blockedIds.push(id); else throw error; }
    }
    return { deletedIds, blockedIds };
  }

  async findStudentsByClass(classId: number, query: ClassPageQuery, executor: PgExecutor = this.pool): Promise<{ page_info: { total_items: number; total_pages: number; current: number; size: number }; records: StudentSummary[] }> { return this.studentPage(`"class_id" = $1 AND "deleted_at" IS NULL`, [classId], query, executor); }
  async findAvailableStudents(query: ClassPageQuery, executor: PgExecutor = this.pool): Promise<{ page_info: { total_items: number; total_pages: number; current: number; size: number }; records: StudentSummary[] }> { return this.studentPage('"class_id" IS NULL AND "deleted_at" IS NULL', [], query, executor); }
  async lockClass(id: number, executor: PgExecutor): Promise<boolean> { return (await executor.query('SELECT "id" FROM "tra_class" WHERE "id" = $1 FOR UPDATE', [id])).rows.length > 0; }
  async lockStudents(ids: number[], executor: PgExecutor): Promise<Array<{ id: unknown; class_id: unknown; deleted_at: unknown }>> { return (await executor.query('SELECT "id", "class_id", "deleted_at" FROM "tra_student" WHERE "id" = ANY($1::int[]) FOR UPDATE', [ids])).rows as Array<{ id: unknown; class_id: unknown; deleted_at: unknown }>; }
  async assignStudents(classId: number, ids: number[], executor: PgExecutor): Promise<void> { await executor.query('UPDATE "tra_student" SET "class_id" = $1, "updated_at" = NOW() WHERE "id" = ANY($2::int[]) AND "class_id" IS NULL AND "deleted_at" IS NULL', [classId, ids]); }
  async removeStudents(classId: number, ids: number[], executor: PgExecutor): Promise<unknown[]> { return (await executor.query('UPDATE "tra_student" SET "class_id" = NULL, "updated_at" = NOW() WHERE "id" = ANY($1::int[]) AND "class_id" = $2 AND "deleted_at" IS NULL RETURNING "id"', [ids, classId])).rows.map((row) => row.id); }
  async findActiveStudent(id: number, executor: PgExecutor = this.pool): Promise<{ id: unknown; class_id: unknown } | null> { return ((await executor.query('SELECT "id", "class_id" FROM "tra_student" WHERE "id" = $1 AND "deleted_at" IS NULL', [id])).rows[0] as { id: unknown; class_id: unknown } | undefined) ?? null; }
  async removeStudent(classId: number, studentId: number, executor: PgExecutor = this.pool): Promise<{ id: unknown } | null> { return ((await executor.query('UPDATE "tra_student" SET "class_id" = NULL, "updated_at" = NOW() WHERE "id" = $1 AND "class_id" = $2 AND "deleted_at" IS NULL RETURNING "id"', [studentId, classId])).rows[0] as { id: unknown } | undefined) ?? null; }

  async findForCopy(id: number, executor: PgExecutor = this.pool): Promise<StudentClass | null> { return ((await executor.query('SELECT * FROM "tra_class" WHERE "id" = $1', [id])).rows[0] as StudentClass | undefined) ?? null; }
  async codeExists(code: string, executor: PgExecutor = this.pool): Promise<boolean> { return (await executor.query('SELECT 1 FROM "tra_class" WHERE "code" = $1', [code])).rows.length > 0; }
  async codesInUse(codes: string[], executor: PgExecutor = this.pool): Promise<string[]> { if (!codes.length) return []; return (await executor.query('SELECT "code" FROM "tra_class" WHERE "code" = ANY($1::text[])', [codes])).rows.map((row) => String(row.code)); }
  async insertCopy(values: { code: string; name: string; description?: unknown }, executor: PgExecutor = this.pool): Promise<StudentClass> { return this.translate(async () => (await executor.query('INSERT INTO "tra_class" ("code", "name", "description", "created_at", "updated_at") VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *', [values.code, values.name, values.description || null])).rows[0] as StudentClass); }
  async findCopySources(ids: number[], executor: PgExecutor = this.pool): Promise<StudentClass[]> { if (!ids.length) return []; return (await executor.query('SELECT "id", "code", "name", "description" FROM "tra_class" WHERE "id" = ANY($1::int[])', [ids])).rows as StudentClass[]; }
  async lockCopySources(ids: number[], executor: PgExecutor): Promise<number[]> { if (!ids.length) return []; return (await executor.query('SELECT "id" FROM "tra_class" WHERE "id" = ANY($1::int[]) FOR SHARE', [ids])).rows.map((row) => Number(row.id)); }
  async insertCopyDrafts(drafts: CopyDraft[], executor: PgExecutor): Promise<StudentClass[]> { const rows: StudentClass[] = []; for (const draft of drafts) rows.push(await this.insertCopy(draft.values, executor)); return rows; }
  async findOneForExport(id: number, executor: PgExecutor = this.pool): Promise<Record<string, unknown> | null> { return ((await executor.query('SELECT "code", "name", "description" FROM "tra_class" WHERE "id" = $1', [id])).rows[0] as Record<string, unknown> | undefined) ?? null; }
  async findManyForExport(ids: unknown[], executor: PgExecutor = this.pool): Promise<Record<string, unknown>[]> { const values = ids.map((_, index) => `$${index + 1}`).join(', '); return (await executor.query(`SELECT "code", "name", "description" FROM "tra_class" WHERE "id" IN (${values}) ORDER BY "id" ASC`, ids)).rows as Record<string, unknown>[]; }

  private async studentPage(where: string, values: unknown[], query: ClassPageQuery, executor: PgExecutor): Promise<{ page_info: { total_items: number; total_pages: number; current: number; size: number }; records: StudentSummary[] }> { const params = [...values]; const conditions = [where]; if (query.search) { params.push(`%${query.search}%`); const parameter = `$${params.length}`; conditions.push(`("code" ILIKE ${parameter} OR "fullname" ILIKE ${parameter} OR "email" ILIKE ${parameter} OR "username" ILIKE ${parameter} OR "description" ILIKE ${parameter})`); } const clause = ` WHERE ${conditions.join(' AND ')}`; const count = await executor.query(`SELECT COUNT(*) FROM "tra_student"${clause}`, params); const selected = this.studentColumns(query.columnlist); const order = this.studentOrder(query.order); const pageParams = [...params, query.size, (query.page - 1) * query.size]; const result = await executor.query(`SELECT ${selected} FROM "tra_student"${clause} ORDER BY ${order} LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`, pageParams); const total = Number.parseInt(String(count.rows[0]?.count ?? 0), 10); return { page_info: { total_items: total, total_pages: Math.ceil(total / query.size), current: query.page, size: query.size }, records: result.rows as StudentSummary[] }; }
  private studentColumns(columnlist?: string): string { const allowed = ['id', 'code', 'fullname', 'dob', 'sex', 'homecity', 'address', 'hair_color', 'email', 'facebook', 'class_id', 'username', 'description', 'hobbies', 'attachment', 'created_at', 'updated_at']; const selected = columnlist?.split(',').map((item) => item.trim()).filter((item) => allowed.includes(item)); return (selected?.length ? selected : allowed).map((item) => `"${item}"`).join(', '); }
  private studentOrder(order?: string): string { const aliases: Record<string, string> = { id: 'id', co: 'code', fn: 'fullname', do: 'dob', sx: 'sex', hc: 'homecity', ad: 'address', hr: 'hair_color', em: 'email', fb: 'facebook', ci: 'class_id', un: 'username', de: 'description', ca: 'created_at', ua: 'updated_at' }; const parts = order?.split('-').map((part) => { const [alias, direction] = part.split(':'); return aliases[alias] ? `"${aliases[alias]}" ${direction === '1' ? 'DESC' : 'ASC'}` : null; }).filter((part): part is string => Boolean(part)); return parts?.length ? parts.join(', ') : '"id" ASC'; }

  private selectColumns(columnlist?: string): string { if (!columnlist) return columns.map((column) => `"${column}"`).join(', '); const selected = columnlist.split(',').map((column) => column.trim()).filter((column): column is typeof columns[number] => (columns as readonly string[]).includes(column)); return (selected.length ? selected : columns).map((column) => `"${column}"`).join(', '); }
  private orderBy(order?: string): string { if (!order) return '"id" ASC'; const parts = order.split('-').map((part) => { const [alias, direction] = part.split(':'); const column = aliases[alias]; return column ? `"${column}" ${direction === '1' ? 'DESC' : 'ASC'}` : null; }).filter((part): part is string => part !== null); return parts.length ? parts.join(', ') : '"id" ASC'; }
  private async translate<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (error) {
      const translated = this.errors.translate(error);
      if (translated instanceof UniqueConstraintViolationError && translated.constraint === 'tra_class_code_key') throw new ClassCodeConflictError({ cause: translated });
      if (translated instanceof ForeignKeyViolationError) throw new ClassDeleteBlockedError({ cause: translated });
      throw translated;
    }
  }
}
