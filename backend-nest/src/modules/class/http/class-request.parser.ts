import { Injectable } from '@nestjs/common';
import { classException } from '../errors/class.errors';
import type { CreateClassDto } from './dto/create-class.dto';
import type { ClassPageQueryDto } from './dto/class-page-query.dto';
import type { UpdateClassDto } from './dto/update-class.dto';
import type { ClassPageQuery, CopyDraft, CreateClassInput, UpdateClassInput } from '../application/class.contracts';

@Injectable()
export class ClassRequestParser {
  parsePage(query: ClassPageQueryDto): ClassPageQuery {
    const page = this.legacyPositiveInt(query.page); if (page === null) throw classException.invalidPage();
    const size = this.legacyPositiveInt(query.size); if (size === null) throw classException.invalidSize();
    const toplist = query.toplist === undefined || query.toplist === '' ? [] : query.toplist.split(',').map((value) => this.legacyPositiveInt(value.trim())).filter((value): value is number => value !== null);
    return { page, size, order: query.order, search: query.search, columnlist: query.columnlist, toplist };
  }

  parseId(value: string, endpoint: 'detail' | 'update' | 'delete'): number {
    const id = this.legacyPositiveInt(value);
    if (id !== null) return id;
    if (endpoint === 'detail') throw classException.invalidDetailId();
    if (endpoint === 'update') throw classException.invalidUpdateId();
    throw classException.invalidDeleteId();
  }

  parseCreate(body: CreateClassDto): CreateClassInput {
    const code = typeof body?.code === 'string' ? body.code.trim() : body?.code;
    const name = typeof body?.name === 'string' ? body.name.trim() : body?.name;
    if (!code || !name) throw classException.required();
    if (code.length > 50) throw classException.codeTooLong();
    if (name.length > 255) throw classException.createNameTooLong();
    return { code, name, description: body.description };
  }

  parseUpdate(body: UpdateClassDto): UpdateClassInput {
    const name = body?.name;
    if (name !== undefined && name.length > 255) throw classException.updateNameTooLong();
    if (name !== undefined && name.trim() === '') throw classException.updateNameBlank();
    return { name, description: body?.description };
  }

  parseMassDelete(ids: unknown): unknown[] {
    if (!Array.isArray(ids) || ids.length === 0) throw classException.invalidMassDeleteIds();
    return [...ids];
  }

  parseMembershipId(value: string): number { const id = this.legacyPositiveInt(value); if (id === null) throw classException.invalidMembershipId(); return id; }
  parseMembershipPage(query: ClassPageQueryDto): ClassPageQuery { const page = this.legacyPositiveInt(query.page); if (page === null) throw classException.invalidMembershipPage(); const size = this.legacyPositiveInt(query.size); if (size === null) throw classException.invalidMembershipSize(); return { page, size, order: query.order, search: query.search, columnlist: query.columnlist, toplist: [] }; }
  parseStudentIds(value: unknown): unknown[] { if (!Array.isArray(value) || value.length === 0) throw classException.invalidStudentIds(); return value; }
  parseCopyId(value: string): number { const id = this.legacyPositiveInt(value); if (id === null) throw classException.invalidCopyId(); return id; }
  parseCopyIds(value: unknown): unknown[] { if (!Array.isArray(value) || value.length === 0) throw classException.invalidCopyDrafts(); return value; }
  parseExportId(value: string): number { const id = this.legacyPositiveInt(value); if (id === null) throw classException.invalidExportId(); return id; }
  parseExportIds(value: unknown): number[] { if (!Array.isArray(value) || value.length === 0) throw classException.invalidExportIds(); const ids = value.map((item) => this.strictPositiveInt(item)); if (ids.some((id) => id === null)) throw classException.invalidExportIds(); return ids as number[]; }
  parseCopyDrafts(value: unknown): CopyDraft[] { if (!Array.isArray(value) || value.length === 0) throw classException.invalidCopyDrafts(); const keys = new Set<string>(); return value.map((draft, index) => { const candidate = draft as Partial<CopyDraft>; const sourceId = Number(candidate?.sourceId); const draftKey = typeof candidate?.draftKey === 'string' ? candidate.draftKey.trim() : ''; if (!Number.isSafeInteger(sourceId) || sourceId <= 0 || !draftKey || keys.has(draftKey) || !candidate?.values || typeof candidate.values !== 'object') throw classException.invalidCopyDrafts(`Draft ${index + 1} không hợp lệ`); keys.add(draftKey); return { draftKey, sourceId, values: this.parseCreate(candidate.values as CreateClassDto) }; }); }

  private legacyPositiveInt(value: unknown): number | null {
    const parsed = Number.parseInt(value as string, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  private strictPositiveInt(value: unknown): number | null { if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null; if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) { const parsed = Number(value); return Number.isSafeInteger(parsed) ? parsed : null; } return null; }
}
