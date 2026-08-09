import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../../../common/database/database.tokens';
import { StudentImportUniqueConflictError, type StudentImportCreate, type StudentImportExportPort, type StudentImportLookup, type StudentImportStudentRecord, type StudentImportUpdate, type StudentPersistenceRecord, type StudentPersistenceTransaction } from '../domain/student-persistence.port';

type PgExecutor = Pick<Pool, 'query'>;
type PgError = { code?: string };
const studentColumns = '"id", "code", "fullname", "dob", "sex", "class_id", "email", "username", "homecity", "address", "hobbies", "description", "hair_color", "facebook"';

@Injectable()
export class StudentPostgresImportExportAdapter implements StudentImportExportPort {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findActiveById(id: number, transaction?: StudentPersistenceTransaction): Promise<StudentImportStudentRecord | null> {
    return this.run(async () => { const result = await this.executor(transaction).query(`SELECT ${studentColumns} FROM "tra_student" WHERE "id"=$1 AND "deleted_at" IS NULL`, [id]); return result.rows[0] ? this.student(result.rows[0]) : null; });
  }

  async findActiveByIds(ids: unknown[], transaction?: StudentPersistenceTransaction): Promise<StudentImportStudentRecord[]> {
    return this.run(async () => (await this.executor(transaction).query(`SELECT ${studentColumns} FROM "tra_student" WHERE "id"=ANY($1::int[]) AND "deleted_at" IS NULL ORDER BY "id" ASC`, [ids])).rows.map((row) => this.student(row)));
  }

  async findImportLookups(transaction?: StudentPersistenceTransaction): Promise<{ classes: StudentImportLookup[]; hobbies: StudentImportLookup[] }> {
    return this.run(async () => { const executor = this.executor(transaction); const [classes, hobbies] = await Promise.all([executor.query('SELECT "id", "code" FROM "tra_class" ORDER BY "id" ASC'), executor.query('SELECT "id", "name", "bit_value" FROM "tra_hobby" WHERE "is_active"=true ORDER BY "bit_value" ASC')]); return { classes: classes.rows.map((row) => ({ id: Number(row.id), code: String(row.code) })), hobbies: hobbies.rows.map((row) => ({ id: Number(row.id), name: String(row.name), bit_value: Number(row.bit_value) })) }; });
  }

  async findActiveByUniqueValues(values: { code: string[]; email: string[]; username: string[] }, transaction?: StudentPersistenceTransaction): Promise<StudentImportStudentRecord[]> {
    return this.run(async () => (await this.executor(transaction).query(`SELECT ${studentColumns} FROM "tra_student" WHERE ("code"=ANY($1::text[]) OR "email"=ANY($2::text[]) OR "username"=ANY($3::text[])) AND "deleted_at" IS NULL`, [values.code, values.email, values.username])).rows.map((row) => this.student(row)));
  }

  async lockActiveByCodes(codes: string[], transaction: StudentPersistenceTransaction): Promise<Array<Pick<StudentImportStudentRecord, 'id' | 'code'>>> {
    return this.run(async () => (await this.executor(transaction).query('SELECT "id", "code" FROM "tra_student" WHERE "code"=ANY($1::text[]) AND "deleted_at" IS NULL FOR UPDATE', [codes])).rows.map((row) => ({ id: Number(row.id), code: String(row.code) })));
  }

  async insertImport(values: StudentImportCreate, transaction: StudentPersistenceTransaction): Promise<StudentPersistenceRecord> {
    return this.run(async () => (await this.executor(transaction).query('INSERT INTO "tra_student" ("code","fullname","dob","sex","class_id","email","username","password","homecity","address","hobbies","description","hair_color","facebook","created_at","updated_at") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW()) RETURNING "id","code"', [values.code, values.fullname, values.dob, values.sex, values.class_id, values.email, values.username, values.password, values.homecity, values.address, values.hobbies, values.description, values.hair_color, values.facebook])).rows[0]);
  }

  async updateImport(id: number, values: StudentImportUpdate, transaction: StudentPersistenceTransaction): Promise<StudentPersistenceRecord> {
    return this.run(async () => { const args: unknown[] = [values.fullname, values.dob, values.sex, values.class_id, values.email, values.username, values.homecity, values.address, values.hobbies, values.description, values.hair_color, values.facebook]; const sets = ['"fullname"=$1', '"dob"=$2', '"sex"=$3', '"class_id"=$4', '"email"=$5', '"username"=$6', '"homecity"=$7', '"address"=$8', '"hobbies"=$9', '"description"=$10', '"hair_color"=$11', '"facebook"=$12', '"updated_at"=NOW()']; if (values.password) { args.push(values.password); sets.push(`"password"=$${args.length}`); } args.push(id); return (await this.executor(transaction).query(`UPDATE "tra_student" SET ${sets.join(',')} WHERE "id"=$${args.length} RETURNING "id","code"`, args)).rows[0]; });
  }

  private executor(transaction?: StudentPersistenceTransaction): PgExecutor { return (transaction as PgExecutor | undefined) ?? this.pool; }
  private async run<T>(work: () => Promise<T>): Promise<T> { try { return await work(); } catch (error) { if ((error as PgError)?.code === '23505') throw new StudentImportUniqueConflictError({ cause: error }); throw error; } }
  private student(row: Record<string, unknown>): StudentImportStudentRecord { return { id: Number(row.id), code: String(row.code), fullname: row.fullname == null ? null : String(row.fullname), dob: row.dob instanceof Date || typeof row.dob === 'string' ? row.dob : null, sex: typeof row.sex === 'boolean' ? row.sex : null, class_id: row.class_id == null ? null : Number(row.class_id), email: row.email == null ? null : String(row.email), username: row.username == null ? null : String(row.username), homecity: row.homecity == null ? null : String(row.homecity), address: row.address == null ? null : String(row.address), hobbies: row.hobbies == null ? null : Number(row.hobbies), description: row.description == null ? null : String(row.description), hair_color: row.hair_color == null ? null : String(row.hair_color), facebook: row.facebook == null ? null : String(row.facebook) }; }
}
