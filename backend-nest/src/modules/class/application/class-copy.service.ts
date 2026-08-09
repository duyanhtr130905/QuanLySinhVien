import { Inject, Injectable } from '@nestjs/common';
import {
  CLASS_COPY_PERSISTENCE,
  CLASS_TRANSACTION,
  ClassCodeConflictError,
  type ClassCopyPersistencePort,
  type ClassTransactionPort,
} from './ports/class-persistence.port';
import type { CopyDraft } from './class.contracts';
import { classApplicationException as classException } from './class-application.errors';

@Injectable()
export class ClassCopyService {
  constructor(
    @Inject(CLASS_COPY_PERSISTENCE) private readonly repository: ClassCopyPersistencePort,
    @Inject(CLASS_TRANSACTION) private readonly transactions: ClassTransactionPort,
  ) {}

  async copyOne(id: number) {
    const source = await this.repository.findForCopy(id);
    if (!source) throw classException.copyNotFound();
    return this.repository.insertCopy({ code: await this.nextCode(source.code), name: source.name, description: source.description }).catch((error) => { throw this.mapPersistenceError(error); });
  }

  async copyMany(values: unknown[]) {
    const ids = values as number[];
    return this.transactions.run(async (transaction) => {
      const created = [];
      const notFound: unknown[] = [];
      for (const id of ids) {
        const source = await this.repository.findForCopy(Number(id), transaction);
        if (!source) { notFound.push(id); continue; }
        created.push(await this.repository.insertCopy({ code: await this.nextCode(source.code, transaction), name: source.name, description: source.description }, transaction));
      }
      if (!created.length && notFound.length) throw classException.copyNotFound(`Không tìm thấy các lớp gốc (ids: ${notFound.join(', ')})`);
      return { created, notFound };
    }).catch((error) => { throw this.mapPersistenceError(error); });
  }

  async preview(values: unknown[]) {
    const ids = [...new Set(values.map(Number))];
    const sources = new Map((await this.repository.findCopySources(ids)).map((source) => [Number(source.id), source]));
    const candidates = new Set<string>();
    sources.forEach((source) => this.candidates(source.code).forEach((code) => candidates.add(code)));
    const occupied = new Set(await this.repository.codesInUse([...candidates]));
    const reserved = new Set<string>();
    const drafts: CopyDraft[] = [];
    const notFoundIds: unknown[] = [];
    for (const id of ids) {
      const source = sources.get(id);
      if (!source) { notFoundIds.push(id); continue; }
      const code = this.candidates(source.code).find((candidate) => !occupied.has(candidate) && !reserved.has(candidate));
      if (!code) throw classException.copyDuplicate('Không thể tạo mã lớp duy nhất');
      reserved.add(code);
      drafts.push({ draftKey: `class-${id}`, sourceId: id, values: { code, name: source.name, description: source.description || '' } });
    }
    return { drafts, notFoundIds };
  }

  async validate(drafts: unknown) {
    const list = Array.isArray(drafts) ? drafts : [];
    const rows = list.map((candidate, index) => {
      const draft = candidate as Partial<CopyDraft>;
      const code = typeof draft?.values?.code === 'string' ? draft.values.code.trim() : '';
      const name = typeof draft?.values?.name === 'string' ? draft.values.name.trim() : '';
      const errors: Record<string, string> = {};
      if (!draft?.draftKey || typeof draft.draftKey !== 'string') errors.draftKey = `Draft ${index + 1} không hợp lệ`;
      if (!Number.isSafeInteger(Number(draft?.sourceId)) || Number(draft.sourceId) <= 0) errors.sourceId = 'Bản ghi gốc không hợp lệ';
      if (!code) errors.code = 'Mã lớp là bắt buộc'; else if (code.length > 50) errors.code = 'Mã lớp không được vượt quá 50 ký tự';
      if (!name) errors.name = 'Tên lớp là bắt buộc'; else if (name.length > 255) errors.name = 'Tên lớp không được vượt quá 255 ký tự';
      return { draft, code, errors };
    });
    const counts = new Map<string, number>();
    rows.forEach((row) => { if (row.code) counts.set(row.code, (counts.get(row.code) ?? 0) + 1); });
    rows.forEach((row) => { if (row.code && (counts.get(row.code) ?? 0) > 1) row.errors.code = 'Mã lớp bị trùng trong các bản sao'; });
    const codes = [...new Set(rows.filter((row) => !row.errors.code && row.code).map((row) => row.code))];
    const existing = new Set(await this.repository.codesInUse(codes));
    rows.forEach((row) => { if (!row.errors.code && existing.has(row.code)) row.errors.code = 'Mã lớp đã tồn tại'; });
    return { rows: rows.map((row) => ({ draftKey: row.draft?.draftKey || '', status: Object.keys(row.errors).length ? 'invalid' : 'valid', errors: row.errors })) };
  }

  async commit(drafts: CopyDraft[]) {
    return this.transactions.run(async (transaction) => {
      const codes = drafts.map((draft) => draft.values.code);
      if (new Set(codes).size !== codes.length) throw classException.copyDuplicate('Mã lớp bị trùng trong các bản sao');
      if ((await this.repository.codesInUse(codes, transaction)).length) throw classException.copyDuplicate('Mã lớp đã tồn tại');
      const ids = [...new Set(drafts.map((draft) => draft.sourceId))];
      const sources = new Set(await this.repository.lockCopySources(ids, transaction));
      const missing = drafts.find((draft) => !sources.has(draft.sourceId));
      if (missing) throw classException.copyNotFound(`Không tìm thấy lớp gốc ${missing.sourceId}`);
      const records = await this.repository.insertCopyDrafts(drafts, transaction);
      return { created: drafts.map((draft, index) => ({ draftKey: draft.draftKey, record: records[index] })) };
    }).catch((error) => { throw this.mapPersistenceError(error); });
  }

  private async nextCode(code: string, transaction?: Parameters<ClassCopyPersistencePort['codeExists']>[1]): Promise<string> {
    for (const candidate of this.candidates(code)) if (!await this.repository.codeExists(candidate, transaction)) return candidate;
    throw classException.copyDuplicate('Không thể tạo mã lớp duy nhất');
  }

  private mapPersistenceError(error: unknown): unknown {
    if (error instanceof ClassCodeConflictError) return classException.copyDuplicate('Mã lớp (code) đã tồn tại');
    return error;
  }

  private candidates(value: string): string[] {
    return Array.from({ length: 100 }, (_, index) => {
      const suffix = index ? `-copy-${index + 1}` : '-copy';
      return `${value}${suffix}`.length > 50 ? `${value.slice(0, 50 - suffix.length)}${suffix}` : `${value}${suffix}`;
    });
  }
}
