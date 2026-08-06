import { Module } from '@nestjs/common';
import { FileCodecRegistry } from './file-codec.registry';
import { CsvFileCodec } from './csv-file.codec';
import { XlsxFileCodec } from './xlsx-file.codec';
import { JsonFileCodec } from './json-file.codec';
import { XmlFileCodec } from './xml-file.codec';

@Module({ providers: [CsvFileCodec, XlsxFileCodec, JsonFileCodec, XmlFileCodec, { provide: FileCodecRegistry, inject: [CsvFileCodec, XlsxFileCodec, JsonFileCodec, XmlFileCodec], useFactory: (...codecs: [CsvFileCodec, XlsxFileCodec, JsonFileCodec, XmlFileCodec]) => { const registry = new FileCodecRegistry(); codecs.forEach((codec) => registry.register(codec)); return registry; } }], exports: [FileCodecRegistry] })
export class FilesModule {}
