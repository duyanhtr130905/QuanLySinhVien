import { Injectable } from '@nestjs/common';
import { classException } from '../errors/class.errors';
import type { CreateClassDto } from './dto/create-class.dto';
import type { ClassPageQueryDto } from './dto/class-page-query.dto';
import type { UpdateClassDto } from './dto/update-class.dto';

export interface ClassPageQuery { page: number; size: number; order?: string; search?: string; columnlist?: string; toplist: number[]; }
export interface CreateClassInput { code: string; name: string; description?: unknown; }
export interface UpdateClassInput { name?: string; description?: unknown; }

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

  private legacyPositiveInt(value: unknown): number | null {
    const parsed = Number.parseInt(value as string, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
}
