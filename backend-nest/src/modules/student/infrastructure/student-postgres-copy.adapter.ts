import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../../../common/database/database.tokens';
import { StudentCopyClassReferenceError, StudentCopyUniqueConflictError, type StudentCopyInsert, type StudentCopyPersistencePort, type StudentCopySource, type StudentCopyUniqueField, type StudentPersistenceRecord, type StudentPersistenceTransaction } from '../domain/student-persistence.port';

type PgExecutor = Pick<Pool, 'query'>;
type PgError = { code?: string; constraint?: string };

const copyColumns = '"id", "code", "fullname", "dob", "sex", "homecity", "address", "hair_color", "email", "facebook", "class_id", "username", "password", "description", "hobbies", "attachment"';
const returnedColumns = '"id", "code", "fullname", "dob", "sex", "homecity", "address", "hair_color", "email", "facebook", "class_id", "username", "description", "hobbies", "attachment", "created_at", "updated_at", "deleted_at"';

@Injectable()
export class StudentPostgresCopyAdapter implements StudentCopyPersistencePort {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findActiveSources(ids: number[], transaction?: StudentPersistenceTransaction): Promise<StudentCopySource[]> {
    if (!ids.length) return [];
    return this.run(async () => (await this.executor(transaction).query(`SELECT ${copyColumns} FROM "tra_student" WHERE "id" = ANY($1::int[]) AND "deleted_at" IS NULL`, [ids])).rows as StudentCopySource[]);
  }

  async findOccupiedUniqueValues(values: { code: string[]; username: string[]; email: string[] }, transaction?: StudentPersistenceTransaction): Promise<{ code: string[]; username: string[]; email: string[] }> {
    return this.run(async () => {
      const rows = (await this.executor(transaction).query(
      'SELECT "code", "username", "email" FROM "tra_student" WHERE "code" = ANY($1::text[]) OR "username" = ANY($2::text[]) OR "email" = ANY($3::text[])',
      [values.code, values.username, values.email],
      )).rows as Array<{ code: string; username: string; email: string }>;
      return { code: rows.map((row) => String(row.code)), username: rows.map((row) => String(row.username)), email: rows.map((row) => String(row.email)) };
    });
  }

  async findExistingClassIds(ids: number[], transaction?: StudentPersistenceTransaction): Promise<number[]> {
    if (!ids.length) return [];
    return this.run(async () => ((await this.executor(transaction).query('SELECT "id" FROM "tra_class" WHERE "id" = ANY($1::int[])', [ids])).rows as Array<{ id: number }>).map((row) => Number(row.id)));
  }

  async lockActiveSources(ids: number[], transaction: StudentPersistenceTransaction): Promise<StudentCopySource[]> {
    if (!ids.length) return [];
    return this.run(async () => (await this.executor(transaction).query(`SELECT ${copyColumns} FROM "tra_student" WHERE "id" = ANY($1::int[]) AND "deleted_at" IS NULL FOR SHARE`, [ids])).rows as StudentCopySource[]);
  }

  async insertCopies(rows: StudentCopyInsert[], transaction: StudentPersistenceTransaction): Promise<StudentPersistenceRecord[]> {
    if (!rows.length) return [];
    return this.run(async () => (await this.executor(transaction).query(
      `INSERT INTO "tra_student" ("code", "fullname", "dob", "sex", "homecity", "address", "hair_color", "email", "facebook", "class_id", "username", "password", "description", "hobbies", "attachment", "created_at", "updated_at")
       SELECT input.*, NOW(), NOW() FROM UNNEST(
         $1::text[], $2::text[], $3::date[], $4::boolean[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[], $10::int[], $11::text[], $12::text[], $13::text[], $14::int[], $15::text[]
       ) AS input(code, fullname, dob, sex, homecity, address, hair_color, email, facebook, class_id, username, password, description, hobbies, attachment)
       RETURNING ${returnedColumns}`,
      [
        rows.map((row) => row.code), rows.map((row) => row.fullname), rows.map((row) => row.dob || null), rows.map((row) => row.sex ?? null),
        rows.map((row) => row.homecity || null), rows.map((row) => row.address || null), rows.map((row) => row.hair_color || null), rows.map((row) => row.email),
        rows.map((row) => row.facebook || null), rows.map((row) => row.class_id || null), rows.map((row) => row.username), rows.map((row) => row.password),
        rows.map((row) => row.description || null), rows.map((row) => row.hobbies), rows.map((row) => row.attachment || null),
      ],
    )).rows as StudentPersistenceRecord[]);
  }

  private executor(transaction?: StudentPersistenceTransaction): PgExecutor { return (transaction as PgExecutor | undefined) ?? this.pool; }
  private async run<T>(work: () => Promise<T>): Promise<T> { try { return await work(); } catch (error) { throw this.translate(error); } }
  private translate(error: unknown): unknown { const database = error as PgError; if (database?.code === '23505') throw new StudentCopyUniqueConflictError(this.uniqueField(database.constraint), { cause: error }); if (database?.code === '23503') throw new StudentCopyClassReferenceError({ cause: error }); return error; }
  private uniqueField(constraint?: string): StudentCopyUniqueField | undefined { return ({ tra_student_code_key: 'code', tra_student_email_key: 'email', tra_student_username_key: 'username' } as const)[constraint ?? '']; }
}
