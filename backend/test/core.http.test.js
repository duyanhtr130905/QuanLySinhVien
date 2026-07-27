const test = require('node:test');
const assert = require('node:assert/strict');
const asyncHandler = require('../src/core/http/asyncHandler');
const AppError = require('../src/core/http/AppError');
const {
  parsePositiveId,
  parseRequiredPositiveId,
  parsePaginationQuery,
  parseIdList,
  parseToplist,
} = require('../src/core/http/requestParsers');
const {
  createGetAllHandler,
  createGetByIdHandler,
  createGetByPageHandler,
  createCopyOneHandler,
  createMassCopyHandler,
} = require('../src/core/http/controllerHandlers');
const { makeReq, makeRes, expectApiResponse, makeNext } = require('./controllerTestHelpers');

test('asyncHandler forwards rejected and synchronous errors to next without writing a response', async () => {
  const rejected = new Error('rejected');
  const rejectedNext = makeNext();
  const rejectedRes = makeRes();
  await asyncHandler(async () => { throw rejected; })(makeReq(), rejectedRes, rejectedNext);
  assert.deepEqual(rejectedNext.calls, [rejected]);
  assert.equal(rejectedRes.body, undefined);

  const thrown = new Error('thrown');
  const thrownNext = makeNext();
  await asyncHandler(() => { throw thrown; })(makeReq(), makeRes(), thrownNext);
  assert.deepEqual(thrownNext.calls, [thrown]);
});

test('AppError exposes HTTP metadata, details, and cause with both supported constructors', () => {
  const cause = new Error('database');
  const direct = new AppError('Không tìm thấy', {
    statusCode: 404,
    errorCode: 'D604',
    details: { id: 7 },
    cause,
  });
  assert.equal(direct.name, 'AppError');
  assert.equal(direct.message, 'Không tìm thấy');
  assert.equal(direct.statusCode, 404);
  assert.equal(direct.errorCode, 'D604');
  assert.deepEqual(direct.details, { id: 7 });
  assert.equal(direct.cause, cause);

  const optionsOnly = new AppError({ message: 'Bad request', statusCode: 400, errorCode: 'E603' });
  assert.equal(optionsOnly.message, 'Bad request');
  assert.equal(optionsOnly.statusCode, 400);
  assert.equal(optionsOnly.errorCode, 'E603');
  assert.equal(optionsOnly.details, undefined);
  assert.equal(optionsOnly.cause, undefined);
});

test('parsePositiveId accepts only safe positive integers by default and has an explicit legacy mode', () => {
  assert.equal(parsePositiveId(4), 4);
  assert.equal(parsePositiveId('004'), 4);
  for (const invalid of [undefined, null, '', '  ', '1x', '1.5', -1, 0, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(parsePositiveId(invalid), null, String(invalid));
  }
  assert.equal(parsePositiveId('1x', { legacyParseInt: true }), 1);
});

test('parseRequiredPositiveId returns a value or throws the configured AppError', () => {
  assert.equal(parseRequiredPositiveId('8'), 8);
  assert.throws(
    () => parseRequiredPositiveId('nope', { statusCode: 422, errorCode: 'X101', message: 'ID sai' }),
    (error) => error instanceof AppError
      && error.statusCode === 422
      && error.errorCode === 'X101'
      && error.message === 'ID sai'
  );
  assert.equal(parseRequiredPositiveId('9suffix', { legacyParseInt: true }), 9);
});

test('parsePaginationQuery returns a new shape, rejects invalid values, and supports legacy toplist parsing', () => {
  const query = { page: '2', size: '10', order: 'co:1', search: 'An', columnlist: 'id', toplist: '1,3' };
  assert.deepEqual(parsePaginationQuery(query), {
    page: 2, size: 10, order: 'co:1', search: 'An', columnlist: 'id', toplist: [1, 3],
  });
  assert.deepEqual(query, { page: '2', size: '10', order: 'co:1', search: 'An', columnlist: 'id', toplist: '1,3' });
  assert.throws(() => parsePaginationQuery({ page: '0', size: '10' }), /Số trang không hợp lệ/);
  assert.throws(
    () => parsePaginationQuery({ page: '1', size: '0' }, { sizeError: { errorCode: 'C602', message: 'Cỡ trang cũ' } }),
    (error) => error.errorCode === 'C602' && error.statusCode === 400 && error.message === 'Cỡ trang cũ'
  );
  assert.deepEqual(
    parsePaginationQuery(
      { page: '1x', size: '2x', toplist: '1x, bad, 3' },
      { legacyParseInt: true, toplistOptions: { legacyParseInt: true, invalid: 'omit' } }
    ),
    { page: 1, size: 2, order: undefined, search: undefined, columnlist: undefined, toplist: [1, 3] }
  );
});

test('parseIdList validates every id without mutation and offers explicit legacy pass-through', () => {
  const input = ['1', 2];
  const parsed = parseIdList(input);
  assert.deepEqual(parsed, [1, 2]);
  assert.notEqual(parsed, input);
  assert.deepEqual(input, ['1', 2]);
  assert.throws(() => parseIdList([1, 'bad']), (error) => error.errorCode === 'INVALID_ID_LIST');
  assert.throws(() => parseIdList([]), (error) => error.statusCode === 400);
  assert.deepEqual(parseIdList([], { allowEmpty: true }), []);
  assert.deepEqual(parseIdList([0, 'bad'], { validate: false }), [0, 'bad']);
});

test('parseToplist is strict by default and can explicitly retain legacy omit behavior', () => {
  assert.deepEqual(parseToplist(undefined), []);
  assert.deepEqual(parseToplist(' 1, 2 '), [1, 2]);
  assert.throws(() => parseToplist('1,bad'), (error) => error.errorCode === 'INVALID_ID_LIST');
  assert.deepEqual(parseToplist('1x, bad, 3', { legacyParseInt: true, invalid: 'omit' }), [1, 3]);
  const values = ['1', '2'];
  const parsed = parseToplist(values);
  assert.deepEqual(parsed, [1, 2]);
  assert.deepEqual(values, ['1', '2']);
});

test('createGetAllHandler uses parser arguments, response mapper, and fallback errors', async () => {
  const calls = [];
  const handler = createGetAllHandler({
    service: async (...args) => { calls.push(args); return [{ id: 1 }]; },
    requestParser: (req) => [req.query.columns],
    responseMapper: (rows) => ({ records: rows }),
    successMessage: 'Danh sách',
    fallbackCode: 'B600',
  });
  const res = makeRes();
  await handler(makeReq({ query: { columns: 'id' } }), res, makeNext());
  expectApiResponse(res, 200, '200', 'Danh sách', { records: [{ id: 1 }] });
  assert.deepEqual(calls, [['id']]);

  const error = new Error('down');
  const failing = createGetAllHandler({ service: async () => { throw error; }, fallbackCode: 'B600' });
  const next = makeNext();
  await failing(makeReq(), makeRes(), next);
  assert.deepEqual(next.calls, [error]);
  assert.equal(error.fallbackCode, 'B600');
});

test('createGetByIdHandler maps a null service result to configured not-found response', async () => {
  const calls = [];
  const handler = createGetByIdHandler({
    service: async (...args) => { calls.push(args); return null; },
    requestParser: (req) => [parseRequiredPositiveId(req.params.id, { errorCode: 'D601', message: 'id không hợp lệ' })],
    successMessage: 'Không dùng',
    fallbackCode: 'D600',
    notFound: { statusCode: 404, errorCode: 'D604', message: 'Không tìm thấy sinh viên' },
  });
  const res = makeRes();
  await handler(makeReq({ params: { id: '7' } }), res, makeNext());
  expectApiResponse(res, 404, 'D604', 'Không tìm thấy sinh viên', null);
  assert.deepEqual(calls, [[7]]);
});

test('createGetByPageHandler keeps parser/service concerns separate', async () => {
  const calls = [];
  const handler = createGetByPageHandler({
    service: async (...args) => { calls.push(args); return { records: [] }; },
    requestParser: (req) => [parsePaginationQuery(req.query)],
    successMessage: (data) => `Có ${data.records.length} bản ghi`,
    fallbackCode: 'C600',
  });
  const res = makeRes();
  await handler(makeReq({ query: { page: '1', size: '5' } }), res, makeNext());
  expectApiResponse(res, 200, '200', 'Có 0 bản ghi', { records: [] });
  assert.deepEqual(calls, [[{ page: 1, size: 5, order: undefined, search: undefined, columnlist: undefined, toplist: [] }]]);
});

test('handler factories return configured AppError responses without using next', async () => {
  const handler = createGetByPageHandler({
    service: async () => { throw new Error('must not be called'); },
    requestParser: () => { throw new AppError({ statusCode: 400, errorCode: 'C601', message: 'Số trang không hợp lệ' }); },
    successMessage: 'Không dùng',
    fallbackCode: 'C600',
  });
  const res = makeRes();
  const next = makeNext();
  await handler(makeReq(), res, next);
  expectApiResponse(res, 400, 'C601', 'Số trang không hợp lệ', null);
  assert.deepEqual(next.calls, []);
});

test('createCopyOneHandler allows dynamic message and not-found predicate', async () => {
  const handler = createCopyOneHandler({
    service: async () => ({ id: 11 }),
    requestParser: () => [3],
    successMessage: (data) => `Đã copy ${data.id}`,
    fallbackCode: 'H600',
    notFound: { when: (data) => data === false, statusCode: 404, errorCode: 'H604', message: 'Không dùng' },
  });
  const res = makeRes();
  await handler(makeReq(), res, makeNext());
  expectApiResponse(res, 200, '200', 'Đã copy 11', { id: 11 });
});

test('createMassCopyHandler supports custom missing-result policy and validates factory configuration', async () => {
  const handler = createMassCopyHandler({
    service: async (ids) => ({ created: [], notFound: ids }),
    requestParser: (req) => [parseIdList(req.body.idlist)],
    successMessage: 'Không dùng',
    fallbackCode: 'H600',
    notFound: {
      when: (data) => data.created.length === 0 && data.notFound.length > 0,
      statusCode: 404,
      errorCode: 'H604',
      message: (data) => `Không tìm thấy ids: ${data.notFound.join(', ')}`,
    },
  });
  const res = makeRes();
  await handler(makeReq({ body: { idlist: [8, 9] } }), res, makeNext());
  expectApiResponse(res, 404, 'H604', 'Không tìm thấy ids: 8, 9', null);
  assert.throws(() => createMassCopyHandler({ requestParser: () => [] }), /service phải là function/);
  const malformedParser = createMassCopyHandler({
    service: async () => null,
    requestParser: () => null,
    fallbackCode: 'H600',
  });
  const next = makeNext();
  await malformedParser(makeReq(), makeRes(), next);
  assert.equal(next.calls.length, 1);
  assert.match(next.calls[0].message, /requestParser phải trả về một mảng service arguments/);
  assert.equal(next.calls[0].fallbackCode, 'H600');
});
