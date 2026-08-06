import { Injectable } from '@nestjs/common';
import { Builder, parseStringPromise } from 'xml2js';
import type { FileCodec } from './file-codec.interface';

@Injectable()
export class XmlFileCodec implements FileCodec {
  readonly format = 'xml' as const;
  async encode(rows: Record<string, unknown>[]): Promise<Buffer> { return Buffer.from(new Builder().buildObject({ records: { record: rows } })); }
  async parse(buffer: Buffer): Promise<Record<string, unknown>[]> { const parsed = await parseStringPromise(buffer.toString('utf8'), { explicitArray: false }) as { records?: { record?: Record<string, unknown> | Record<string, unknown>[] } }; const records = parsed.records?.record; if (!records) throw new Error('XML phải có cấu trúc <records><record>...</record></records>'); return Array.isArray(records) ? records : [records]; }
}
