import { FileFormat } from './file-format.type';

export interface FileCodec {
  readonly format: FileFormat;
  encode(rows: Record<string, unknown>[]): Promise<Buffer>;
  parse(buffer: Buffer): Promise<Record<string, unknown>[]>;
}
