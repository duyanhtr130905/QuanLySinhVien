import { LegacyApiException } from '../../../common/http/legacy-api.exception';
import { ClassRequestParser } from './class-request.parser';
const parser = new ClassRequestParser();
const expectErrorCode = (work: () => unknown, code: string) => {
  try { work(); } catch (error) { expect(error).toMatchObject({ code }); return; }
  throw new Error('Expected LegacyApiException');
};
describe('ClassRequestParser', () => {
  it('preserves legacy parseInt paging, ids, and toplist omission', () => { expect(parser.parsePage({ page: '2x', size: '5.5', toplist: '1,bad,3x', order: 'co:1', search: 'A', columnlist: 'id' })).toEqual({ page: 2, size: 5, toplist: [1, 3], order: 'co:1', search: 'A', columnlist: 'id' }); expect(parser.parseId('1x', 'detail')).toBe(1); });
  it('maps invalid page, size, and ids to endpoint errors', () => { expect(() => parser.parsePage({ page: '0', size: '1' })).toThrow(LegacyApiException); expect(() => parser.parsePage({ page: '1', size: 'bad' })).toThrow(LegacyApiException); expectErrorCode(() => parser.parseId('-1', 'delete'), 'G601'); });
  it('validates create, keeps description raw, ignores update code, and keeps update name untrimmed', () => { expect(parser.parseCreate({ code: ' C01 ', name: ' Lớp 1 ', description: ' raw ' })).toEqual({ code: 'C01', name: 'Lớp 1', description: ' raw ' }); expect(parser.parseUpdate({ code: 'other', name: '  still raw  ' })).toEqual({ name: '  still raw  ', description: undefined }); expectErrorCode(() => parser.parseCreate({ code: '', name: 'A' }), 'E603'); expectErrorCode(() => parser.parseUpdate({ name: '  ' }), 'F603'); });
  it('only checks mass-delete ids as a non-empty array', () => { expect(parser.parseMassDelete([1, 'bad', 0])).toEqual([1, 'bad', 0]); expectErrorCode(() => parser.parseMassDelete([]), 'I604'); });
});
