const test = require('node:test');
const assert = require('node:assert/strict');
const { loadController, makeReq, makeRes, expectApiResponse, makeNext } = require('./controllerTestHelpers');

const AppError = require('../src/core/http/AppError');

const controllerFor = (serviceMock, fileFormatMock) => loadController({
  controller: '../src/modules/class/class.controller.js',
  service: '../src/modules/class/class.service.js',
  serviceMock,
  dependencies: fileFormatMock ? { '../src/utils/fileFormat.js': fileFormatMock } : {},
});

test('class.getAll returns the service payload and forwards columnlist', async () => {
  const calls = [];
  const controller = controllerFor({ getAll: async (...args) => { calls.push(args); return [{ id: 1 }]; } });
  const res = makeRes();
  await controller.getAll(makeReq({ query: { columnlist: 'id,name' } }), res, makeNext());
  expectApiResponse(res, 200, '200', 'Lấy danh sách lớp thành công', [{ id: 1 }]);
  assert.deepEqual(calls, [['id,name']]);
});

test('class.getAll sends an unhandled service error to next with B600 fallback', async () => {
  const error = new Error('database down');
  const controller = controllerFor({ getAll: async () => { throw error; } });
  const res = makeRes();
  const next = makeNext();
  await controller.getAll(makeReq(), res, next);
  assert.equal(res.body, undefined);
  assert.deepEqual(next.calls, [error]);
  assert.equal(error.fallbackCode, 'B600');
});

test('class.getByPage rejects invalid page and size before calling the service', async () => {
  let called = false;
  const controller = controllerFor({ getByPage: async () => { called = true; } });
  const pageRes = makeRes();
  await controller.getByPage(makeReq({ query: { page: '0', size: '10' } }), pageRes, makeNext());
  expectApiResponse(pageRes, 400, 'C601', 'Số trang không hợp lệ', null);
  const sizeRes = makeRes();
  await controller.getByPage(makeReq({ query: { page: '1', size: '0' } }), sizeRes, makeNext());
  expectApiResponse(sizeRes, 400, 'C602', 'Cỡ trang không hợp lệ', null);
  assert.equal(called, false);
});

test('class.getByPage parses paging inputs and forwards its current object shape', async () => {
  const calls = [];
  const pageData = { page_info: { current: 2 }, records: [{ id: 9 }] };
  const controller = controllerFor({ getByPage: async (...args) => { calls.push(args); return pageData; } });
  const res = makeRes();
  await controller.getByPage(makeReq({ query: { page: '2', size: '5', order: 'co:1', search: 'A', columnlist: 'id', toplist: ' 1, nope, 3 ' } }), res, makeNext());
  expectApiResponse(res, 200, '200', 'Lấy danh sách lớp theo trang thành công', pageData);
  assert.deepEqual(calls, [[{ page: 2, size: 5, order: 'co:1', search: 'A', columnlist: 'id', toplist: [1, 3] }]]);
});

test('class.store returns its current success contract and maps duplicate code', async () => {
  const calls = [];
  const controller = controllerFor({ store: async (...args) => { calls.push(args); return { id: 7 }; } });
  const res = makeRes();
  await controller.store(makeReq({ body: { code: 'C01', name: 'Class 1', description: 'x' } }), res, makeNext());
  expectApiResponse(res, 200, '200', 'Tạo lớp thành công', { id: 7 });
  assert.deepEqual(calls, [[{ code: 'C01', name: 'Class 1', description: 'x' }]]);

  const duplicate = controllerFor({ store: async () => { const err = new Error(); err.code = '23505'; throw err; } });
  const duplicateRes = makeRes();
  await duplicate.store(makeReq({ body: { code: 'C01', name: 'Class 1' } }), duplicateRes, makeNext());
  expectApiResponse(duplicateRes, 409, 'E603', 'Mã lớp (code) đã tồn tại', null);
});

test('class.update ignores code and forwards only mutable fields', async () => {
  const calls = [];
  const controller = controllerFor({ update: async (...args) => { calls.push(args); return { id: 7 }; } });
  const res = makeRes();
  await controller.update(makeReq({ params: { id: '7' }, body: { code: 'C02', description: 'new' } }), res, makeNext());
  expectApiResponse(res, 200, '200', 'Cập nhật lớp thành công', { id: 7 });
  assert.deepEqual(calls, [[7, { code: undefined, name: undefined, description: 'new' }]]);
});

test('class.destroy distinguishes a missing class from an FK-blocked class', async () => {
  const missing = controllerFor({ existsById: async () => false, destroy: async () => { throw new Error('must not run'); } });
  const missingRes = makeRes();
  await missing.destroy(makeReq({ params: { id: '5' } }), missingRes, makeNext());
  expectApiResponse(missingRes, 404, 'G604', 'Không tìm thấy bản ghi lớp học', null);

  const blocked = controllerFor({ existsById: async () => true, destroy: async () => { const err = new Error(); err.code = '23503'; throw err; } });
  const blockedRes = makeRes();
  await blocked.destroy(makeReq({ params: { id: '5' } }), blockedRes, makeNext());
  expectApiResponse(blockedRes, 409, 'G605', 'Không thể xóa: Lớp học này vẫn còn sinh viên liên kết', null);
});

test('class.massDelete keeps a partial delete as a 200 response', async () => {
  const calls = [];
  const controller = controllerFor({ massDelete: async (...args) => { calls.push(args); return { deletedIds: [1], blockedIds: [2, 3] }; } });
  const res = makeRes();
  await controller.massDelete(makeReq({ body: { ids: [1, 2, 3] } }), res, makeNext());
  expectApiResponse(res, 200, '200', 'Đã xóa 1 lớp. Không thể xóa 2 lớp vì còn sinh viên liên kết (ids: 2, 3)', { deletedIds: [1], blockedIds: [2, 3] });
  assert.deepEqual(calls, [[[1, 2, 3]]]);
});

test('class.copyOne reports the copied record and forwards a numeric id', async () => {
  const calls = [];
  const controller = controllerFor({ copyOne: async (...args) => { calls.push(args); return { id: 8, code: 'C01-copy' }; } });
  const res = makeRes();
  await controller.copyOne(makeReq({ params: { id: '4' } }), res, makeNext());
  expectApiResponse(res, 200, '200', 'Sao chép lớp thành công', { id: 8, code: 'C01-copy' });
  assert.deepEqual(calls, [[4]]);
});

test('class.massCopy preserves partial-copy success and its service arguments', async () => {
  const calls = [];
  const controller = controllerFor({ massCopy: async (...args) => { calls.push(args); return { created: [{ id: 8 }], notFound: [99] }; } });
  const res = makeRes();
  await controller.massCopy(makeReq({ body: { idlist: [4, 99] } }), res, makeNext());
  expectApiResponse(res, 200, '200', 'Đã sao chép 1 lớp. Không tìm thấy ids: 99', [{ id: 8 }]);
  assert.deepEqual(calls, [[[4, 99]]]);
});
