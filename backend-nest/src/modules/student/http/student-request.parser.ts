import { Injectable } from '@nestjs/common';
import type { StudentPageQuery, StudentWriteInput } from '../application/student.contracts';
import { StudentWritePolicy } from '../application/student-write.policy';
import { studentCopyException, studentException } from '../errors/student.errors';
import type { StudentPageQueryDto } from './dto/student-page-query.dto';

@Injectable()
export class StudentRequestParser {
  private readonly writes = new StudentWritePolicy();

  parsePage(query: StudentPageQueryDto): StudentPageQuery {
    const page = this.positive(query.page);
    if (page === null) throw studentException.invalidPage();
    const size = this.positive(query.size);
    if (size === null) throw studentException.invalidSize();
    const parse = (raw: unknown) => this.values(raw).map((value) => this.positive(value)).filter((value): value is number => value !== null);
    return { page, size, order: query.order, search: query.search, columnlist: query.columnlist, toplist: parse(query.toplist), excludeIds: parse(query.exclude_ids ?? query['exclude_ids[]']) };
  }

  parseId(value: unknown): number { const id = this.positive(value); if (id === null) throw studentException.invalidId(); return id; }
  parseUpdateId(value: unknown): number { const id = this.positive(value); if (id === null) throw studentException.updateInvalidId(); return id; }
  parseDestroyId(value: unknown): number { const id = this.positive(value); if (id === null) throw studentException.destroyInvalidId(); return id; }
  parseDestroyIds(value: unknown): unknown[] { if (!Array.isArray(value) || value.length === 0) throw studentException.destroyInvalidIds(); return [...value]; }
  parseTrashIds(value: unknown): number[] {
    if (!Array.isArray(value) || value.length === 0) throw studentException.trashInvalidIds();
    const ids = [...new Set(value.map((item) => this.strictPositive(item)).filter((id): id is number => id !== null))];
    if (!ids.length) throw studentException.trashInvalidIds();
    return ids;
  }
  parseCopyId(value: unknown): number { const id = this.positive(value); if (id === null) throw studentCopyException.invalidId(); return id; }
  parseCopyIds(value: unknown): unknown[] { if (!Array.isArray(value) || value.length === 0) throw studentCopyException.invalidIds(); return value; }
  parseWrite(body: Record<string, unknown> | undefined, create: boolean, activeMask: number): StudentWriteInput { return this.writes.parse(body, create, activeMask); }

  private positive(value: unknown): number | null { const parsed = Number.parseInt(String(Array.isArray(value) ? value[0] : value), 10); return Number.isInteger(parsed) && parsed > 0 ? parsed : null; }
  private strictPositive(value: unknown): number | null { if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null; if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) { const parsed = Number(value); return Number.isSafeInteger(parsed) ? parsed : null; } return null; }
  private values(value: unknown): unknown[] { if (value === undefined || value === '') return []; return Array.isArray(value) ? value : String(value).split(','); }
}
