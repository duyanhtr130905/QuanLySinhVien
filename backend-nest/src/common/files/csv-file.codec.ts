import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import type { FileCodec } from './file-codec.interface';

@Injectable()
export class CsvFileCodec implements FileCodec {
  readonly format = 'csv' as const;
  async encode(rows: Record<string, unknown>[]): Promise<Buffer> { return Buffer.from(stringify(rows, { header: true })); }
  async parse(buffer: Buffer): Promise<Record<string, unknown>[]> { return parse(buffer, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, unknown>[]; }
}
