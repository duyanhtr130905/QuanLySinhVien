import { Inject, Injectable, Logger } from '@nestjs/common';
import { OBJECT_STORAGE } from '../../../common/storage/storage.tokens';
import type { ObjectStorage } from '../../../common/storage/object-storage.interface';
import { studentCopyException, studentException } from '../errors/student.errors';
import { STUDENT_COPY_PERSISTENCE, STUDENT_REPOSITORY, STUDENT_TRANSACTION, StudentCopyClassReferenceError, StudentCopyUniqueConflictError, type StudentAttachmentUpload, type StudentCopyDraft, type StudentCopyInsert, type StudentCopyPersistencePort, type StudentCopySource, type StudentPersistenceRecord, type StudentRepositoryPort, type StudentTransactionPort, type StudentCopyUniqueField } from '../domain/student-persistence.port';

type UniqueField = 'code' | 'username' | 'email';
type Draft = StudentCopyDraft;

const imageTypes = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const emailPattern = /^[0-9a-zA-Z.\-_]+@[0-9a-zA-Z.\-_]+$/;
const facebookPattern = /^https?:\/\/[0-9a-zA-Z.\-_]+$/;

@Injectable()
export class StudentCopyService {
  private readonly logger = new Logger(StudentCopyService.name);

  constructor(
    @Inject(STUDENT_COPY_PERSISTENCE) private readonly copies: StudentCopyPersistencePort,
    @Inject(STUDENT_TRANSACTION) private readonly transactions: StudentTransactionPort,
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepositoryPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async copyOne(id: number): Promise<StudentPersistenceRecord> {
    try { return await this.transactions.run(async (transaction) => {
      const source = (await this.copies.findActiveSources([id], transaction))[0];
      if (!source) throw studentCopyException.notFound();
      const values = await this.copyValues([source], transaction);
      return (await this.copies.insertCopies([{ ...values[0], password: source.password }], transaction))[0];
    }); } catch (error) { throw this.mapPersistenceError(error); }
  }

  async copyMany(ids: unknown[]): Promise<{ created: StudentPersistenceRecord[]; notFound: unknown[] }> {
    try { return await this.transactions.run(async (transaction) => {
      const numericIds = ids.map(Number);
      const sources = await this.copies.findActiveSources([...new Set(numericIds)], transaction);
      const sourceById = new Map(sources.map((source) => [source.id, source]));
      const found = numericIds.map((id) => sourceById.get(id));
      const notFound = ids.filter((_, index) => !found[index]);
      const foundSources = found.filter((source): source is StudentCopySource => Boolean(source));
      if (!foundSources.length) throw studentCopyException.massNotFound(notFound);
      const values = await this.copyValues(foundSources, transaction);
      const created = await this.copies.insertCopies(values.map((value, index) => ({ ...value, password: foundSources[index].password })), transaction);
      return { created, notFound };
    }); } catch (error) { throw this.mapPersistenceError(error); }
  }

  async preview(ids: unknown[]): Promise<{ drafts: StudentCopyDraft[]; notFoundIds: unknown[] }> {
    const uniqueIds = [...new Set(ids)];
    const numericIds = uniqueIds.map(Number);
    const sources = await this.copies.findActiveSources(numericIds);
    const sourceById = new Map(sources.map((source) => [source.id, source]));
    const foundSources = numericIds.map((id) => sourceById.get(id)).filter((source): source is StudentCopySource => Boolean(source));
    const values = await this.copyValues(foundSources);
    let valueIndex = 0;
    const drafts: StudentCopyDraft[] = [];
    const notFoundIds: unknown[] = [];
    uniqueIds.forEach((id, index) => {
      if (!sourceById.has(numericIds[index])) notFoundIds.push(id);
      else drafts.push({ draftKey: `student-${id}`, sourceId: numericIds[index], values: values[valueIndex++] });
    });
    return { drafts, notFoundIds };
  }

  async validate(rawDrafts: unknown): Promise<{ rows: Array<{ draftKey: string; status: string; errors: Record<string, string> }> }> {
    const list = Array.isArray(rawDrafts) ? rawDrafts : [];
    const rows = list.map((candidate, index) => this.validationRow(candidate, index));
    for (const field of ['code', 'username', 'email'] as const) {
      const counts = new Map<string, number>();
      rows.forEach((row) => { if (row[field]) counts.set(row[field], (counts.get(row[field]) ?? 0) + 1); });
      rows.forEach((row) => { if (row[field] && (counts.get(row[field]) ?? 0) > 1) row.errors[field] = `${field} bị trùng trong các bản sao`; });
    }
    const values = (field: UniqueField) => [...new Set(rows.filter((row) => !row.errors[field] && row[field]).map((row) => row[field]))];
    const classIds = [...new Set(rows.filter((row): row is typeof row & { classId: number } => !row.errors.class_id && row.classId !== null).map((row) => row.classId))];
    const [occupied, existingClasses] = await Promise.all([
      this.copies.findOccupiedUniqueValues({ code: values('code'), username: values('username'), email: values('email') }),
      this.copies.findExistingClassIds(classIds),
    ]);
    const existing = { code: new Set(occupied.code), username: new Set(occupied.username), email: new Set(occupied.email) };
    const classes = new Set(existingClasses);
    rows.forEach((row) => {
      (['code', 'username', 'email'] as const).forEach((field) => { if (!row.errors[field] && existing[field].has(row[field])) row.errors[field] = `${field} đã tồn tại`; });
      if (!row.errors.class_id && row.classId !== null && !classes.has(row.classId)) row.errors.class_id = 'Lớp không tồn tại';
    });
    return { rows: rows.map((row) => ({ draftKey: row.draftKey, status: Object.keys(row.errors).length ? 'invalid' : 'valid', errors: row.errors })) };
  }

  async commit(rawDrafts: unknown, files: StudentAttachmentUpload[] = []): Promise<{ created: Array<{ draftKey: string; record: StudentPersistenceRecord | undefined }> }> {
    const drafts = await this.parseCommitDrafts(rawDrafts);
    const uploaded = new Map<string, string>();
    try {
      for (const file of files) {
        const draftKey = file.fieldname.replace(/^attachment-/, '');
        const draft = drafts.find((item) => item.draftKey === draftKey);
        if (!draft || uploaded.has(draftKey)) throw studentCopyException.invalidIds('Ảnh draft không hợp lệ');
        uploaded.set(draftKey, await this.uploadAttachment(file, draft.values.code));
      }
      return await this.transactions.run(async (transaction) => {
        this.assertDraftUnique(drafts);
        const occupied = await this.copies.findOccupiedUniqueValues(this.uniqueValues(drafts), transaction);
        if (occupied.code.length || occupied.username.length || occupied.email.length) throw studentCopyException.conflict('Code, username hoặc email đã tồn tại');
        const sourceIds = [...new Set(drafts.map((draft) => draft.sourceId))];
        const sources = await this.copies.lockActiveSources(sourceIds, transaction);
        const sourceById = new Map(sources.map((source) => [source.id, source]));
        const missing = sourceIds.find((id) => !sourceById.has(id));
        if (missing !== undefined) throw studentCopyException.notFound(`Không tìm thấy sinh viên gốc ${missing}`);
        const classIds = [...new Set(drafts.map((draft) => draft.values.class_id).filter((id): id is number => id !== null))];
        const classes = new Set(await this.copies.findExistingClassIds(classIds, transaction));
        if (classIds.some((id) => !classes.has(id))) throw studentCopyException.conflict('class_id không tồn tại');
        const inserted = await this.copies.insertCopies(drafts.map((draft) => ({ ...draft.values, password: sourceById.get(draft.sourceId)!.password, attachment: uploaded.get(draft.draftKey) ?? sourceById.get(draft.sourceId)!.attachment ?? null })), transaction);
        const byCode = new Map(inserted.map((record) => [String(record.code), record]));
        return { created: drafts.map((draft) => ({ draftKey: draft.draftKey, record: byCode.get(draft.values.code) })) };
      });
    } catch (error) {
      await Promise.all([...uploaded.values()].map((url) => this.cleanupAttachment(url)));
      throw this.mapPersistenceError(error);
    }
  }

  private async copyValues(sources: StudentCopySource[], transaction?: Parameters<StudentCopyPersistencePort['findActiveSources']>[1]): Promise<Array<Omit<StudentCopyInsert, 'password'>>> {
    const candidates = { code: new Set<string>(), username: new Set<string>(), email: new Set<string>() };
    sources.forEach((source) => (['code', 'username', 'email'] as const).forEach((field) => this.candidates(field, source[field], field === 'email' ? 256 : 50).forEach((candidate) => candidates[field].add(candidate))));
    const occupiedValues = await this.copies.findOccupiedUniqueValues({ code: [...candidates.code], username: [...candidates.username], email: [...candidates.email] }, transaction);
    const occupied = { code: new Set(occupiedValues.code), username: new Set(occupiedValues.username), email: new Set(occupiedValues.email) };
    const reserved = { code: new Set<string>(), username: new Set<string>(), email: new Set<string>() };
    return sources.map((source) => {
      const values = this.pickValues(source);
      values.code = this.nextCandidate('code', values.code, 50, occupied.code, reserved.code);
      values.username = this.nextCandidate('username', values.username, 50, occupied.username, reserved.username);
      values.email = this.nextCandidate('email', values.email, 256, occupied.email, reserved.email);
      return values;
    });
  }

  private validationRow(candidate: unknown, index: number) {
    const draft = candidate as { draftKey?: unknown; sourceId?: unknown; values?: Record<string, unknown> } | undefined;
    const raw = draft?.values ?? {};
    const errors: Record<string, string> = {};
    const code = this.text(raw.code); const fullname = this.text(raw.fullname); const username = this.text(raw.username); const email = this.text(raw.email).toLowerCase();
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
    const activeMask = await this.students.activeHobbyMask();
    const keys = new Set<string>();
    return rawDrafts.map((raw, index) => {
      const draft = raw as { draftKey?: unknown; sourceId?: unknown; values?: Record<string, unknown> };
      const draftKey = this.text(draft?.draftKey); const sourceId = Number(draft?.sourceId);
      if (!draftKey || keys.has(draftKey) || !Number.isSafeInteger(sourceId) || sourceId <= 0 || !draft?.values || typeof draft.values !== 'object') throw studentCopyException.invalidIds(`Draft ${index + 1} không hợp lệ`);
      keys.add(draftKey);
      const values = this.normalizedValues(draft.values);
      if (!values.code || !values.fullname || !values.email || !values.username || (values.class_id !== null && (!Number.isSafeInteger(values.class_id) || values.class_id <= 0)) || !Number.isInteger(values.hobbies)) throw studentCopyException.invalidIds(`Dữ liệu draft ${index + 1} không hợp lệ`);
      const validation = this.fullValidation(values, activeMask);
      if (validation) throw studentCopyException.invalidIds(validation);
      return { draftKey, sourceId, values };
    });
  }

  private normalizedValues(raw: Record<string, unknown>): Draft['values'] { return { code: this.text(raw.code), fullname: this.text(raw.fullname), dob: typeof raw.dob === 'string' ? raw.dob : null, sex: typeof raw.sex === 'boolean' ? raw.sex : null, homecity: this.text(raw.homecity), address: this.text(raw.address), hair_color: this.text(raw.hair_color).toUpperCase(), email: this.text(raw.email).toLowerCase(), facebook: this.text(raw.facebook), class_id: raw.class_id === '' || raw.class_id == null ? null : Number(raw.class_id), username: this.text(raw.username), description: this.text(raw.description), hobbies: raw.hobbies == null || raw.hobbies === '' ? 0 : Number(raw.hobbies), attachment: null }; }
  private fullValidation(values: Draft['values'], activeMask: number): string | null { if (values.code.length > 50) return 'code không được vượt quá 50 ký tự'; if (values.username.length > 50) return 'username không được vượt quá 50 ký tự'; if (!values.fullname.trim()) return 'fullname không được để trống'; if (values.fullname.length > 30) return 'fullname không được vượt quá 30 ký tự'; if (String(values.homecity).length > 100) return 'homecity không được vượt quá 100 ký tự'; if (String(values.address).length > 100) return 'address không được vượt quá 100 ký tự'; if (String(values.hair_color).length > 7) return 'hair_color không được vượt quá 7 ký tự'; if (values.email.length > 256 || !emailPattern.test(values.email)) return values.email.length > 256 ? 'email không được vượt quá 256 ký tự' : 'email không đúng định dạng'; if (values.facebook && (values.facebook.length > 256 || !facebookPattern.test(values.facebook))) return values.facebook.length > 256 ? 'facebook không được vượt quá 256 ký tự' : 'facebook phải là URL hợp lệ (http/https)'; if (!Number.isInteger(values.hobbies) || values.hobbies < 0 || (values.hobbies & ~activeMask) !== 0) return 'hobbies chứa giá trị không hợp lệ (bit hobby không tồn tại hoặc đã inactive)'; return null; }
  private pickValues(source: StudentCopySource): Draft['values'] { const { id: _id, password: _password, ...values } = source; return { ...values }; }
  private candidates(field: UniqueField, original: string, max: number): string[] { return Array.from({ length: 100 }, (_, index) => this.candidate(field, original, max, index + 1)); }
  private candidate(field: UniqueField, original: string, max: number, count: number): string { const suffix = count === 1 ? '-copy' : `-copy-${count}`; if (field !== 'email') return `${original}${suffix}`.length > max ? `${original.slice(0, max - suffix.length)}${suffix}` : `${original}${suffix}`; const at = original.lastIndexOf('@'); const local = original.slice(0, at); const domain = original.slice(at + 1); const copy = `${local}${suffix}`; return copy.length + 1 + domain.length > max ? `${local.slice(0, max - 1 - domain.length - suffix.length)}${suffix}@${domain}` : `${copy}@${domain}`; }
  private nextCandidate(field: UniqueField, original: string, max: number, occupied: Set<string>, reserved: Set<string>): string { const candidate = this.candidates(field, original, max).find((value) => !occupied.has(value) && !reserved.has(value)); if (!candidate) throw studentCopyException.conflict(`Không thể tạo giá trị duy nhất cho ${field}`); reserved.add(candidate); return candidate; }
  private uniqueValues(drafts: Draft[]) { return { code: drafts.map((draft) => draft.values.code), username: drafts.map((draft) => draft.values.username), email: drafts.map((draft) => draft.values.email) }; }
  private assertDraftUnique(drafts: Draft[]): void { for (const field of ['code', 'username', 'email'] as const) { const values = drafts.map((draft) => draft.values[field]); if (new Set(values).size !== values.length) throw studentCopyException.conflict(`${field} bị trùng trong các bản sao`); } }
  private async uploadAttachment(file: StudentAttachmentUpload, code: string): Promise<string> { if (!imageTypes.has(file.mimetype) || file.size > 5 * 1024 * 1024) throw studentException.createValidation('Ảnh phải là jpg/jpeg/png, tối đa 5MB'); const name = file.originalname.replace(/[^A-Za-z0-9._-]/g, '_'); const key = `students/${code.replace(/[^A-Za-z0-9._-]/g, '_')}-${Date.now()}-${name}`; await this.storage.upload({ key, body: file.buffer, contentType: file.mimetype }); return this.storage.getPublicUrl(key); }
  private async cleanupAttachment(url: string): Promise<void> { try { await this.storage.delete(url); } catch { this.logger.warn('Could not compensate newly uploaded student copy attachment.'); } }
  private mapPersistenceError(error: unknown): unknown { if ((error as { code?: string })?.code === 'H603' || (error as { code?: string })?.code === 'H604') return error; if (error instanceof StudentCopyUniqueConflictError) return studentCopyException.conflict(this.uniqueMessage(error.field)); if (error instanceof StudentCopyClassReferenceError) return studentCopyException.conflict('class_id không tồn tại'); return error; }
  private uniqueMessage(field?: StudentCopyUniqueField): string { if (!field) return 'Dữ liệu đã tồn tại (vi phạm ràng buộc UNIQUE)'; return ({ code: 'Mã sinh viên (code) đã tồn tại', email: 'Email đã tồn tại', username: 'Username đã tồn tại' } as const)[field]; }
  private text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
}
