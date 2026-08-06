import { Pool } from 'pg';

export class ContractFixtures {
  private readonly pool: Pool;
  private readonly classIds: unknown[] = [];
  private readonly studentIds: unknown[] = [];
  constructor() { if (process.env.NODE_ENV === 'production') throw new Error('Contract database fixtures are disabled in production.'); if (process.env.CONTRACT_ALLOW_DB_FIXTURES !== 'true') throw new Error('CONTRACT_ALLOW_DB_FIXTURES=true is required for membership contract tests.'); if (!process.env.CONTRACT_DATABASE_URL) throw new Error('CONTRACT_DATABASE_URL is required for membership contract tests.'); this.pool = new Pool({ connectionString: process.env.CONTRACT_DATABASE_URL, ssl: { rejectUnauthorized: false } }); }
  trackClass(id: unknown): void { this.classIds.push(id); }
  async student(suffix: string): Promise<string> { const result = await this.pool.query('INSERT INTO "tra_student" ("code", "fullname", "dob", "sex", "class_id", "email", "username", "password", "homecity", "address", "hobbies", "created_at", "updated_at") VALUES ($1,$2,$3,$4,NULL,$5,$6,$7,NULL,NULL,0,NOW(),NOW()) RETURNING "id"', [`ct-student-${suffix}`, 'Contract Student', '2000-01-01', true, `ct-${suffix}@example.test`, `ct-${suffix}`, 'not-used']); const id = result.rows[0].id as string; this.studentIds.push(id); return id; }
  async studentRead(suffix: string): Promise<string> { const result = await this.pool.query('INSERT INTO "tra_student" ("code", "fullname", "dob", "sex", "class_id", "email", "username", "password", "homecity", "address", "hobbies", "created_at", "updated_at") VALUES ($1,$2,$3,$4,NULL,$5,$6,$7,NULL,NULL,0,NOW(),NOW()) RETURNING "id"', [`ct-student-read-${suffix}`, 'Contract Student Read', '2000-01-01', true, `ct-student-read-${suffix}@example.test`, `ct-student-read-${suffix}`, 'not-used']); const id = result.rows[0].id as string; this.studentIds.push(id); return id; }
  async cleanup(): Promise<void> { for (const id of this.studentIds) { await this.pool.query('DELETE FROM "tra_student" WHERE "id" = $1', [id]); await this.pool.query('DELETE FROM "tra_student" WHERE "id" = $1 AND "deleted_at" IS NOT NULL', [id]); } for (const id of this.classIds) await this.pool.query('DELETE FROM "tra_class" WHERE "id" = $1', [id]); await this.pool.end(); }
}
