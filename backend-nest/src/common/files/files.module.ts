import { Module } from '@nestjs/common';
import { FileCodecRegistry } from './file-codec.registry';

@Module({ providers: [FileCodecRegistry], exports: [FileCodecRegistry] })
export class FilesModule {}
