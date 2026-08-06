import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import type { FileCodec } from './file-codec.interface';

@Injectable()
export class XlsxFileCodec implements FileCodec {
  readonly format = 'xlsx' as const;
  async encode(rows: Record<string, unknown>[]): Promise<Buffer> { const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Students'); return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }); }
  async parse(buffer: Buffer): Promise<Record<string, unknown>[]> { const workbook = XLSX.read(buffer); const sheet = workbook.Sheets[workbook.SheetNames[0]]; return XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[]; }
}
