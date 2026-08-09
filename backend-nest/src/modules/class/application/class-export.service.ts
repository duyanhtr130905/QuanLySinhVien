import { Inject, Injectable } from '@nestjs/common';
import { FileCodecRegistry } from '../../../common/files/file-codec.registry';
import type { FileFormat } from '../../../common/files/file-format.type';
import { CLASS_EXPORT_PERSISTENCE, type ClassExportPersistencePort } from '../domain/class-persistence.port';
import { classApplicationException as classException } from './class-application.errors';

const types = ['csv', 'xlsx', 'json', 'xml'] as const;
const contentTypes: Record<FileFormat, string> = { csv: 'text/csv', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', json: 'application/json', xml: 'application/xml' };

@Injectable()
export class ClassExportService {
  constructor(@Inject(CLASS_EXPORT_PERSISTENCE) private readonly repository: ClassExportPersistencePort, private readonly codecs: FileCodecRegistry) {}
  async one(id: number, type: unknown) { const format = this.format(type); const record = await this.repository.findOneForExport(id); if (!record) throw classException.exportNotFound(); return this.file([record], format, `class-${id}.${format}`); }
  async many(ids: unknown[], type: unknown) { const format = this.format(type); return this.file(await this.repository.findManyForExport(ids), format, `classes-export.${format}`); }
  private async file(rows: Record<string, unknown>[], format: FileFormat, filename: string) { return { buffer: await this.codecs.get(format).encode(rows.map((row) => ({ code: row.code, name: row.name, description: row.description }))), contentType: contentTypes[format], filename }; }
  private format(value: unknown): FileFormat { const format = String(value ?? 'xlsx').toLowerCase(); if (!(types as readonly string[]).includes(format)) throw classException.invalidExport(); return format as FileFormat; }
}
