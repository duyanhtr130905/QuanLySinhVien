import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../../../common/database/database.tokens';
import { PgTransactionManager } from '../../../common/database/pg-transaction-manager';
import { OBJECT_STORAGE } from '../../../common/storage/storage.tokens';
import type { ObjectStorage } from '../../../common/storage/object-storage.interface';
import { studentCopyException, studentException, studentUniqueMessage } from '../errors/student.errors';

type CopyField = 'code' | 'fullname' | 'dob' | 'sex' | 'homecity' | 'address' | 'hair_color' | 'email' | 'facebook' | 'class_id' | 'username' | 'description' | 'hobbies' | 'attachment';
type CopyValues = Record<CopyField, unknown> & { code: string; fullname: string; email: string; username: string; class_id: number | null; hobbies: number; attachment: string | null };
type Draft = { draftKey: string; sourceId: number; values: CopyValues };
type Source = CopyValues & { id: number; password: string };
type PgError = { code?: string; constraint?: string };

const fields: readonly CopyField[] = ['code', 'fullname', 'dob', 'sex', 'homecity', 'address', 'hair_color', 'email', 'facebook', 'class_id', 'username', 'description', 'hobbies', 'attachment'];
const imageTypes = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const emailPattern = /^[0-9a-zA-Z.\-_]+@[0-9a-zA-Z.\-_]+$/;
const facebookPattern = /^https?:\/\/[0-9a-zA-Z.\-_]+$/;

@Injectable()
export class StudentCopyService {
  private readonly logger = new Logger(StudentCopyService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly transactions: PgTransactionManager,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async copyOne(id: number) {
    return this.transactions.run(async (client) => {
      const record = await this.copyOneWithClient(client, id);
      if (!record) throw studentCopyException.notFound();
      return record;
    });
  }

  async copyMany(ids: unknown[]) {
    return this.transactions.run(async (client) => {
      const created: unknown[] = [];
      const notFound: unknown[] = [];
      for (const id of ids) {
        const record = await this.copyOneWithClient(client, id);
        if (record) created.push(record); else notFound.push(id);
      }
      if (!created.length && notFound.length) throw studentCopyException.massNotFound(notFound);
      return { created, notFound };
    });
  }

  // Read-only: exactly two batch queries, with no storage work.
  async preview(ids: unknown[]) {
    const uniqueIds = [...new Set(ids)];
    const sources = (await this.pool.query(
      `SELECT "id", "code", "fullname", "dob", "sex", "homecity", "address", "hair_color", "email", "facebook", "class_id", "username", "description", "hobbies", "attachment"
       FROM "tra_student" WHERE "id" = ANY($1::int[]) AND "deleted_at" IS NULL`,
      [uniqueIds],
    )).rows as Source[];
    const sourcesById = new Map(sources.map((source) => [Number(source.id), source]));
    const candidateSets = { code: new Set<string>(), username: new Set<string>(), email: new Set<string>() };
    sources.forEach((source) => {
      this.candidates('code', String(source.code), 50).forEach((candidate) => candidateSets.code.add(candidate));
      this.candidates('username', String(source.username), 50).forEach((candidate) => candidateSets.username.add(candidate));
      this.candidates('email', String(source.email), 256).forEach((candidate) => candidateSets.email.add(candidate));
    });
    const existing = await this.pool.query(
      `SELECT "code", "username", "email" FROM "tra_student"
       WHERE "code" = ANY($1::text[]) OR "username" = ANY($2::text[]) OR "email" = ANY($3::text[])`,
      [[...candidateSets.code], [...candidateSets.username], [...candidateSets.email]],
    );
    const occupied = {
      code: new Set(existing.rows.map((row) => String(row.code))),
      username: new Set(existing.rows.map((row) => String(row.username))),
      email: new Set(existing.rows.map((row) => String(row.email))),
    };
    const reserved = { code: new Set<string>(), username: new Set<string>(), email: new Set<string>() };
    const drafts: Draft[] = [];
    const notFoundIds: unknown[] = [];
    for (const id of uniqueIds) {
      const source = sourcesById.get(Number(id));
      if (!source) { notFoundIds.push(id); continue; }
      const values = this.pickValues(source);
      values.code = this.nextCandidate('code', values.code, 50, occupied.code, reserved.code);
      values.username = this.nextCandidate('username', values.username, 50, occupied.username, reserved.username);
      values.email = this.nextCandidate('email', values.email, 256, occupied.email, reserved.email);
      drafts.push({ draftKey: `student-${id}`, sourceId: Number(id), values });
    }
    return { drafts, notFoundIds };
  }

  // Read-only: two batch lookups at most (unique values and referenced classes).
  async validate(rawDrafts: unknown) {
    const list = Array.isArray(rawDrafts) ? rawDrafts : [];
    const rows = list.map((candidate, index) => this.validationRow(candidate, index));
    for (const field of ['code', 'username', 'email'] as const) {
      const counts = new Map<string, number>();
      rows.forEach((row) => { if (row[field]) counts.set(row[field], (counts.get(row[field]) ?? 0) + 1); });
      rows.forEach((row) => { if (row[field] && (counts.get(row[field]) ?? 0) > 1) row.errors[field] = `${field} bị trùng trong các bản sao`; });
    }
    const values = (field: 'code' | 'username' | 'email') => [...new Set(rows.filter((row) => !row.errors[field] && row[field]).map((row) => row[field]))];
    const classIds = [...new Set(rows.filter((row) => !row.errors.class_id && row.classId !== null).map((row) => row.classId))];
    const [existingResult, classResult] = await Promise.all([
      this.pool.query(
        'SELECT "code", "username", "email" FROM "tra_student" WHERE "code" = ANY($1::text[]) OR "username" = ANY($2::text[]) OR "email" = ANY($3::text[])',
        [values('code'), values('username'), values('email')],
      ),
      classIds.length ? this.pool.query('SELECT "id" FROM "tra_class" WHERE "id" = ANY($1::int[])', [classIds]) : Promise.resolve({ rows: [] as Array<{ id: number }> }),
    ]);
    const existing = {
      code: new Set(existingResult.rows.map((row) => String(row.code))),
      username: new Set(existingResult.rows.map((row) => String(row.username))),
      email: new Set(existingResult.rows.map((row) => String(row.email))),
    };
    const classes = new Set(classResult.rows.map((row) => Number(row.id)));
    rows.forEach((row) => {
      (['code', 'username', 'email'] as const).forEach((field) => {
        if (!row.errors[field] && existing[field].has(row[field])) row.errors[field] = `${field} đã tồn tại`;
      });
      if (!row.errors.class_id && row.classId !== null && !classes.has(row.classId)) row.errors.class_id = 'Lớp không tồn tại';
    });
    return { rows: rows.map((row) => ({ draftKey: row.draftKey, status: Object.keys(row.errors).length ? 'invalid' : 'valid', errors: row.errors })) };
  }

  async commit(rawDrafts: unknown, files: Express.Multer.File[] = []) {
    const drafts = await this.parseCommitDrafts(rawDrafts);
    const uploaded = new Map<string, string>();
    try {
      for (const file of files) {
        const draftKey = file.fieldname.replace(/^attachment-/, '');
        const draft = drafts.find((item) => item.draftKey === draftKey);
        if (!draft || uploaded.has(draftKey)) throw studentCopyException.invalidIds('Ảnh draft không hợp lệ');
        uploaded.set(draftKey, await this.uploadAttachment(file, draft.values.code));
      }
      return await this.transactions.run(async (client) => {
        this.assertDraftUnique(drafts);
        const existing = await client.query(
          'SELECT "code", "username", "email" FROM "tra_student" WHERE "code" = ANY($1::text[]) OR "username" = ANY($2::text[]) OR "email" = ANY($3::text[])',
          [drafts.map((draft) => draft.values.code), drafts.map((draft) => draft.values.username), drafts.map((draft) => draft.values.email)],
        );
        if (existing.rows.length) throw studentCopyException.conflict('Code, username hoặc email đã tồn tại');
        const sourceIds = [...new Set(drafts.map((draft) => draft.sourceId))];
        const sources = (await client.query(
          'SELECT "id", "password", "attachment" FROM "tra_student" WHERE "id" = ANY($1::int[]) AND "deleted_at" IS NULL FOR SHARE',
          [sourceIds],
        )).rows as Pick<Source, 'id' | 'password' | 'attachment'>[];
        const sourceById = new Map(sources.map((source) => [Number(source.id), source]));
        const missing = sourceIds.find((id) => !sourceById.has(id));
        if (missing !== undefined) throw studentCopyException.notFound(`Không tìm thấy sinh viên gốc ${missing}`);
        const inserted = await client.query(
          `INSERT INTO "tra_student" ("code", "fullname", "dob", "sex", "homecity", "address", "hair_color", "email", "facebook", "class_id", "username", "password", "description", "hobbies", "attachment", "created_at", "updated_at")
           SELECT input.*, NOW(), NOW() FROM UNNEST(
             $1::text[], $2::text[], $3::date[], $4::boolean[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[], $10::int[], $11::text[], $12::text[], $13::text[], $14::int[], $15::text[]
           ) AS input(code, fullname, dob, sex, homecity, address, hair_color, email, facebook, class_id, username, password, description, hobbies, attachment)
           RETURNING "id", "code", "fullname", "dob", "sex", "homecity", "address", "hair_color", "email", "facebook", "class_id", "username", "description", "hobbies", "attachment", "created_at", "updated_at", "deleted_at"`,
          [
            drafts.map((draft) => draft.values.code), drafts.map((draft) => draft.values.fullname), drafts.map((draft) => draft.values.dob || null),
            drafts.map((draft) => draft.values.sex ?? null), drafts.map((draft) => draft.values.homecity || null), drafts.map((draft) => draft.values.address || null),
            drafts.map((draft) => draft.values.hair_color || null), drafts.map((draft) => draft.values.email), drafts.map((draft) => draft.values.facebook || null),
            drafts.map((draft) => draft.values.class_id || null), drafts.map((draft) => draft.values.username), drafts.map((draft) => sourceById.get(draft.sourceId)!.password),
            drafts.map((draft) => draft.values.description || null), drafts.map((draft) => draft.values.hobbies ?? 0), drafts.map((draft) => uploaded.get(draft.draftKey) ?? sourceById.get(draft.sourceId)!.attachment ?? null),
          ],
        );
        const byCode = new Map(inserted.rows.map((record) => [String(record.code), record]));
        return { created: drafts.map((draft) => ({ draftKey: draft.draftKey, record: byCode.get(draft.values.code) })) };
      });
    } catch (error) {
      await Promise.all([...uploaded.values()].map((url) => this.cleanupAttachment(url)));
      throw this.mapCommitError(error);
    }
  }

  private async copyOneWithClient(client: PoolClient, id: unknown) {
    const sourceResult = await client.query('SELECT * FROM "tra_student" WHERE "id" = $1 AND "deleted_at" IS NULL', [id]);
    if (!sourceResult.rows.length) return null;
    const source = sourceResult.rows[0] as Source;
    const values = this.pickValues(source);
    values.code = await this.nextCandidateInTransaction(client, 'code', values.code, 50);
    values.username = await this.nextCandidateInTransaction(client, 'username', values.username, 50);
    values.email = await this.nextCandidateInTransaction(client, 'email', values.email, 256);
    try {
      const result = await client.query(
        `INSERT INTO "tra_student" ("code", "fullname", "dob", "sex", "homecity", "address", "hair_color", "email", "facebook", "class_id", "username", "password", "description", "hobbies", "attachment", "created_at", "updated_at")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW())
         RETURNING "id", "code", "fullname", "dob", "sex", "homecity", "address", "hair_color", "email", "facebook", "class_id", "username", "description", "hobbies", "attachment", "created_at", "updated_at", "deleted_at"`,
        [values.code, values.fullname, values.dob, values.sex, values.homecity, values.address, values.hair_color, values.email, values.facebook, values.class_id, values.username, source.password, values.description, values.hobbies, values.attachment],
      );
      return result.rows[0];
    } catch (error) { throw this.mapCommitError(error); }
  }

  private validationRow(candidate: unknown, index: number) {
    const draft = candidate as { draftKey?: unknown; sourceId?: unknown; values?: Record<string, unknown> } | undefined;
    const raw = draft?.values ?? {};
    const errors: Record<string, string> = {};
    const code = this.text(raw.code);
    const fullname = this.text(raw.fullname);
    const username = this.text(raw.username);
    const email = this.text(raw.email).toLowerCase();
    const classId = raw.class_id === '' || raw.class_id == null ? null : Number(raw.class_id);
    if (!draft?.draftKey || typeof draft.draftKey !== 'string') errors.draftKey = `Draft ${index + 1} không hợp lệ`;
    if (!Number.isSafeInteger(Number(draft?.sourceId)) || Number(draft?.sourceId) <= 0) errors.sourceId = 'Bản ghi gốc không hợp lệ';
    if (!code) errors.code = 'Mã sinh viên là bắt buộc'; else if (code.length > 50) errors.code = 'Mã sinh viên không được vượt quá 50 ký tự';
    if (!fullname) errors.fullname = 'Họ tên là bắt buộc'; else if (fullname.length > 30) errors.fullname = 'Họ tên không được vượt quá 30 ký tự';
    if (!username) errors.username = 'Username là bắt buộc'; else if (username.length > 50) errors.username = 'Username không được vượt quá 50 ký tự';
    if (!email) errors.email = 'Email là bắt buộc'; else if (email.length > 256 || !emailPattern.test(email)) errors.email = 'Email không đúng định dạng';
    if (classId !== null && (!Number.isSafeInteger(classId) || classId <= 0)) errors.class_id = 'ID lớp không hợp lệ';
    if (raw.hobbies !== undefined && raw.hobbies !== null && raw.hobbies !== '' && (!Number.isInteger(Number(raw.hobbies)) || Number(raw.hobbies) < 0)) errors.hobbies = 'Sở thích không hợp lệ';
    return { draftKey: typeof draft?.draftKey === 'string' ? draft.draftKey : '', code, username, email, classId, errors };
  }

  private async parseCommitDrafts(rawDrafts: unknown): Promise<Draft[]> {
    if (!Array.isArray(rawDrafts) || !rawDrafts.length) throw studentCopyException.invalidIds();
    const activeMask = Number((await this.pool.query('SELECT COALESCE(bit_or("bit_value"), 0) AS mask FROM "tra_hobby" WHERE "is_active" = true')).rows[0]?.mask ?? 0);
    const keys = new Set<string>();
    return rawDrafts.map((raw, index) => {
      const draft = raw as { draftKey?: unknown; sourceId?: unknown; values?: Record<string, unknown> };
      const draftKey = this.text(draft?.draftKey);
      const sourceId = Number(draft?.sourceId);
      if (!draftKey || keys.has(draftKey) || !Number.isSafeInteger(sourceId) || sourceId <= 0 || !draft?.values || typeof draft.values !== 'object') throw studentCopyException.invalidIds(`Draft ${index + 1} không hợp lệ`);
      keys.add(draftKey);
      const values = this.normalizedValues(draft.values);
      if (!values.code || !values.fullname || !values.email || !values.username || (values.class_id !== null && (!Number.isSafeInteger(values.class_id) || values.class_id <= 0)) || !Number.isInteger(values.hobbies)) throw studentCopyException.invalidIds(`Dữ liệu draft ${index + 1} không hợp lệ`);
      const validation = this.fullValidation(values, activeMask);
      if (validation) throw studentCopyException.invalidIds(validation);
      return { draftKey, sourceId, values };
    });
  }

  private normalizedValues(raw: Record<string, unknown>): CopyValues {
    return {
      code: this.text(raw.code), fullname: this.text(raw.fullname), dob: raw.dob || null, sex: raw.sex ?? null,
      homecity: this.text(raw.homecity), address: this.text(raw.address), hair_color: this.text(raw.hair_color).toUpperCase(), email: this.text(raw.email).toLowerCase(),
      facebook: this.text(raw.facebook), class_id: raw.class_id === '' || raw.class_id == null ? null : Number(raw.class_id), username: this.text(raw.username),
      description: this.text(raw.description), hobbies: raw.hobbies == null || raw.hobbies === '' ? 0 : Number(raw.hobbies), attachment: null,
    };
  }

  private fullValidation(values: CopyValues, activeMask: number): string | null {
    if (values.code.length > 50) return 'code không được vượt quá 50 ký tự';
    if (values.username.length > 50) return 'username không được vượt quá 50 ký tự';
    if (!values.fullname.trim()) return 'fullname không được để trống';
    if (values.fullname.length > 30) return 'fullname không được vượt quá 30 ký tự';
    if (String(values.homecity).length > 100) return 'homecity không được vượt quá 100 ký tự';
    if (String(values.address).length > 100) return 'address không được vượt quá 100 ký tự';
    if (String(values.hair_color).length > 7) return 'hair_color không được vượt quá 7 ký tự';
    if (values.email.length > 256 || !emailPattern.test(values.email)) return values.email.length > 256 ? 'email không được vượt quá 256 ký tự' : 'email không đúng định dạng';
    if (values.facebook && (String(values.facebook).length > 256 || !facebookPattern.test(String(values.facebook)))) return String(values.facebook).length > 256 ? 'facebook không được vượt quá 256 ký tự' : 'facebook phải là URL hợp lệ (http/https)';
    if (!Number.isInteger(values.hobbies) || values.hobbies < 0 || (values.hobbies & ~activeMask) !== 0) return 'hobbies chứa giá trị không hợp lệ (bit hobby không tồn tại hoặc đã inactive)';
    return null;
  }

  private pickValues(source: Source): CopyValues { return Object.fromEntries(fields.map((field) => [field, source[field] == null ? null : source[field]])) as CopyValues; }
  private candidates(field: 'code' | 'username' | 'email', original: string, max: number): string[] { return Array.from({ length: 100 }, (_, index) => this.candidate(field, original, max, index + 1)); }
  private candidate(field: 'code' | 'username' | 'email', original: string, max: number, count: number): string { const suffix = count === 1 ? '-copy' : `-copy-${count}`; if (field !== 'email') return `${original}${suffix}`.length > max ? `${original.slice(0, max - suffix.length)}${suffix}` : `${original}${suffix}`; const at = original.lastIndexOf('@'); const local = original.slice(0, at); const domain = original.slice(at + 1); const copy = `${local}${suffix}`; return copy.length + 1 + domain.length > max ? `${local.slice(0, max - 1 - domain.length - suffix.length)}${suffix}@${domain}` : `${copy}@${domain}`; }
  private nextCandidate(field: 'code' | 'username' | 'email', original: string, max: number, occupied: Set<string>, reserved: Set<string>): string { const candidate = this.candidates(field, original, max).find((value) => !occupied.has(value) && !reserved.has(value)); if (!candidate) throw studentCopyException.conflict(`Không thể tạo giá trị duy nhất cho ${field}`); reserved.add(candidate); return candidate; }
  private async nextCandidateInTransaction(client: PoolClient, field: 'code' | 'username' | 'email', original: string, max: number): Promise<string> { for (const candidate of this.candidates(field, original, max)) { const result = await client.query(`SELECT 1 FROM "tra_student" WHERE "${field}" = $1`, [candidate]); if (!result.rows.length) return candidate; } throw studentCopyException.conflict(`Không thể tạo giá trị unique cho ${field}`); }
  private assertDraftUnique(drafts: Draft[]): void { for (const field of ['code', 'username', 'email'] as const) { const values = drafts.map((draft) => draft.values[field]); if (new Set(values).size !== values.length) throw studentCopyException.conflict(`${field} bị trùng trong các bản sao`); } }
  private async uploadAttachment(file: Express.Multer.File, code: string): Promise<string> { if (!imageTypes.has(file.mimetype) || file.size > 5 * 1024 * 1024) throw studentException.createValidation('Ảnh phải là jpg/jpeg/png, tối đa 5MB'); const name = file.originalname.replace(/[^A-Za-z0-9._-]/g, '_'); const key = `students/${code.replace(/[^A-Za-z0-9._-]/g, '_')}-${Date.now()}-${name}`; await this.storage.upload({ key, body: file.buffer, contentType: file.mimetype }); return this.storage.getPublicUrl(key); }
  private async cleanupAttachment(url: string): Promise<void> { try { await this.storage.delete(url); } catch { this.logger.warn('Could not compensate newly uploaded student copy attachment.'); } }
  private mapCommitError(error: unknown): unknown { if ((error as { code?: string })?.code === 'H603' || (error as { code?: string })?.code === 'H604') return error; const pg = error as PgError; if (pg?.code === '23505') return studentCopyException.conflict(studentUniqueMessage(pg.constraint)); if (pg?.code === '23503') return studentCopyException.conflict('class_id không tồn tại'); return error; }
  private text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
}
