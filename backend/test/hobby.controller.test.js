const test = require('node:test');
const assert = require('node:assert/strict');
const { loadController, makeReq, makeRes, expectApiResponse, makeNext } = require('./controllerTestHelpers');

const controllerFor = (serviceMock) => loadController({
  controller: '../src/modules/hobby/hobby.controller.js',
  service: '../src/modules/hobby/hobby.service.js',
  serviceMock,
});

test('hobby.getAll returns active hobbies from the service', async () => {
  const controller = controllerFor({ getAll: async () => [{ id: 1, bit_value: 1 }] });
  const res = makeRes();
  await controller.getAll(makeReq(), res, makeNext());
  expectApiResponse(res, 200, '200', 'Lấy danh sách sở thích thành công', [{ id: 1, bit_value: 1 }]);
});

test('hobby.store trims name before passing it to the service', async () => {
  const calls = [];
  const controller = controllerFor({ store: async (...args) => { calls.push(args); return { id: 2, name: 'Đọc sách' }; } });
  const res = makeRes();
  await controller.store(makeReq({ body: { name: '  Đọc sách  ' } }), res, makeNext());
  expectApiResponse(res, 200, '200', 'Tạo sở thích thành công', { id: 2, name: 'Đọc sách' });
  assert.deepEqual(calls, [['Đọc sách']]);
});

test('hobby.store preserves bit-exhausted and duplicate-constraint response contracts', async () => {
  const exhausted = controllerFor({ store: async () => { const err = new Error('Đã hết bit khả dụng cho hobbies'); err.isBitExhausted = true; throw err; } });
  const exhaustedRes = makeRes();
  await exhausted.store(makeReq({ body: { name: 'Đọc sách' } }), exhaustedRes, makeNext());
  expectApiResponse(exhaustedRes, 422, 'E604', 'Đã hết bit khả dụng cho hobbies', null);

  const duplicate = controllerFor({ store: async () => { const err = new Error(); err.code = '23505'; err.constraint = 'tra_hobby_name_key'; throw err; } });
  const duplicateRes = makeRes();
  await duplicate.store(makeReq({ body: { name: 'Đọc sách' } }), duplicateRes, makeNext());
  expectApiResponse(duplicateRes, 409, 'E603', 'Tên sở thích đã tồn tại', null);
});

test('hobby.destroy handles success, currently-in-use, and not-found contracts', async () => {
  const successCalls = [];
  const success = controllerFor({
    findById: async () => ({ id: 3, bit_value: 4 }),
    isUsedByStudent: async () => false,
    destroy: async (...args) => { successCalls.push(args); return { id: 3 }; },
  });
  const successRes = makeRes();
  await success.destroy(makeReq({ params: { id: '3' } }), successRes, makeNext());
  expectApiResponse(successRes, 200, '200', 'Xóa sở thích thành công', { id: 3 });
  assert.deepEqual(successCalls, [[3]]);

  const inUse = controllerFor({ findById: async () => ({ id: 3, bit_value: 4 }), isUsedByStudent: async () => true });
  const inUseRes = makeRes();
  await inUse.destroy(makeReq({ params: { id: '3' } }), inUseRes, makeNext());
  expectApiResponse(inUseRes, 409, 'G605', 'Không thể xóa: sở thích này đang được sinh viên sử dụng', null);

  const missing = controllerFor({ findById: async () => null });
  const missingRes = makeRes();
  await missing.destroy(makeReq({ params: { id: '3' } }), missingRes, makeNext());
  expectApiResponse(missingRes, 404, 'G604', 'Không tìm thấy hobby', null);
});
