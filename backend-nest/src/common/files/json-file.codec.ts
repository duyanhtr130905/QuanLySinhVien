import { Injectable } from '@nestjs/common';
import type { FileCodec } from './file-codec.interface';

@Injectable()
export class JsonFileCodec implements FileCodec {
  readonly format = 'json' as const;
  async encode(rows: Record<string, unknown>[]): Promise<Buffer> { return Buffer.from(JSON.stringify(rows, null, 2)); }
  async parse(buffer: Buffer): Promise<Record<string, unknown>[]> { const parsed: unknown = JSON.parse(buffer.toString('utf8')); if (Array.isArray(parsed)) return parsed as Record<string, unknown>[]; if (typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { records?: unknown }).records)) return (parsed as { records: Record<string, unknown>[] }).records; throw new Error('JSON phải là mảng hoặc { records: [...] }'); }
}
