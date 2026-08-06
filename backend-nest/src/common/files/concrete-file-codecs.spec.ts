import { CsvFileCodec } from './csv-file.codec';
import { JsonFileCodec } from './json-file.codec';
import { XlsxFileCodec } from './xlsx-file.codec';
import { XmlFileCodec } from './xml-file.codec';
describe('concrete file codecs', () => {
  it.each([new CsvFileCodec(), new XlsxFileCodec(), new JsonFileCodec(), new XmlFileCodec()])('round-trips %s', async (codec) => { const rows = [{ code: 'C1', name: 'Name', description: 'D' }]; await expect(codec.parse(await codec.encode(rows))).resolves.toEqual(rows); });
});
