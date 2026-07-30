import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { BasePgRepository, type PgRepositoryMetadata } from '../../../common/database/base-pg.repository';
import { PG_POOL } from '../../../common/database/database.tokens';
import { PgErrorTranslator } from '../../../common/database/pg-error-translator';
import type { PgExecutor } from '../../../common/database/pg-executor.type';
import type { ClassPageQuery, CreateClassInput, UpdateClassInput } from '../http/class-request.parser';
import type { StudentClass } from '../domain/student-class.entity';
import { ForeignKeyViolationError } from '../../../common/database/errors/database-infrastructure.error';

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
      catch (error) { if (error instanceof ForeignKeyViolationError) blockedIds.push(id); else throw error; }
    }
    return { deletedIds, blockedIds };
  }

  private selectColumns(columnlist?: string): string { if (!columnlist) return columns.map((column) => `"${column}"`).join(', '); const selected = columnlist.split(',').map((column) => column.trim()).filter((column): column is typeof columns[number] => (columns as readonly string[]).includes(column)); return (selected.length ? selected : columns).map((column) => `"${column}"`).join(', '); }
  private orderBy(order?: string): string { if (!order) return '"id" ASC'; const parts = order.split('-').map((part) => { const [alias, direction] = part.split(':'); const column = aliases[alias]; return column ? `"${column}" ${direction === '1' ? 'DESC' : 'ASC'}` : null; }).filter((part): part is string => part !== null); return parts.length ? parts.join(', ') : '"id" ASC'; }
  private async translate<T>(operation: () => Promise<T>): Promise<T> { try { return await operation(); } catch (error) { throw this.errors.translate(error); } }
}
