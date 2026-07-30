import { Injectable } from '@nestjs/common';
import { FileCodec } from './file-codec.interface';
import { FileFormat } from './file-format.type';

@Injectable()
export class FileCodecRegistry {
  private readonly codecs = new Map<FileFormat, FileCodec>();

  register(codec: FileCodec): void {
    if (this.codecs.has(codec.format)) throw new Error(`codec already registered for format: ${codec.format}`);
    this.codecs.set(codec.format, codec);
  }

  get(format: FileFormat): FileCodec {
    const codec = this.codecs.get(format);
    if (!codec) throw new Error(`unsupported file format: ${format}`);
    return codec;
  }
}
