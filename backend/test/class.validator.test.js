const test = require('node:test');
const assert = require('node:assert/strict');
const AppError = require('../src/core/http/AppError');
const validator = require('../src/modules/class/class.validator');
const errors = require('../src/modules/class/class.errors');

const expectError = (fn, expected) => assert.throws(
  fn,
  (error) => error instanceof AppError
    && error.statusCode === expected.statusCode
    && error.errorCode === expected.errorCode
    && error.message === expected.message
);

test('class errors retain the exact existing API error configurations', () => {
  assert.deepEqual(errors.getByPage.invalidPage, { statusCode: 400, errorCode: 'C601', message: 'Số trang không hợp lệ' });
  assert.deepEqual(errors.store.duplicate, { statusCode: 409, errorCode: 'E603', message: 'Mã lớp (code) đã tồn tại' });
  assert.deepEqual(errors.destroy.foreignKeyBlocked, {
    statusCode: 409,
    errorCode: 'G605',
    message: 'Không thể xóa: Lớp học này vẫn còn sinh viên liên kết',
  });
  assert.equal(Object.isFrozen(errors), true);
  assert.equal(Object.isFrozen(errors.massCopy), true);
  assert.equal(Object.isFrozen(errors.massCopy.notFound), true);
});

test('class page validator preserves legacy parseInt and toplist omission behavior', () => {
  const query = { page: '2x', size: '5.5', order: 'co:1', search: 'A', columnlist: 'id', toplist: ' 1, nope, 3x ' };
  const parsed = validator.parseGetByPage(query);
  assert.deepEqual(parsed, {
    page: 2,
    size: 5,
    order: 'co:1',
    search: 'A',
    columnlist: 'id',
    toplist: [1, 3],
  });
  assert.deepEqual(query, { page: '2x', size: '5.5', order: 'co:1', search: 'A', columnlist: 'id', toplist: ' 1, nope, 3x ' });
  expectError(() => validator.parseGetByPage({ page: '0', size: '1' }), errors.getByPage.invalidPage);
  expectError(() => validator.parseGetByPage({ page: '1', size: '' }), errors.getByPage.invalidSize);
});

test('class id validators preserve positive legacy parseInt behavior and endpoint error codes', () => {
  assert.equal(validator.parseUpdateId('4suffix'), 4);
  assert.equal(validator.parseDestroyId(3.8), 3);
  assert.equal(validator.parseCopyOneId('9'), 9);
  expectError(() => validator.parseUpdateId('0'), errors.update.invalidId);
  expectError(() => validator.parseDestroyId('bad'), errors.destroy.invalidId);
  expectError(() => validator.parseCopyOneId(undefined), errors.copyOne.invalidId);
});

test('class id list validators only retain the existing array/non-empty validation contract', () => {
  const ids = [1, 'bad', 0];
  const deleted = validator.parseMassDeleteIds(ids);
  assert.deepEqual(deleted, ids);
  assert.notEqual(deleted, ids);
  assert.deepEqual(validator.parseMassCopyIdList(ids), ids);
  expectError(() => validator.parseMassDeleteIds([]), errors.massDelete.invalidIds);
  expectError(() => validator.parseMassCopyIdList('1,2'), errors.massCopy.invalidIdList);
});

test('class store validation normalizes code and name before required and maximum-length checks', () => {
  const body = { code: '  C01  ', name: '  Lớp 01  ', description: 'Mô tả' };
  assert.deepEqual(validator.validateStore(body), { code: 'C01', name: 'Lớp 01', description: 'Mô tả' });
  assert.deepEqual(body, { code: '  C01  ', name: '  Lớp 01  ', description: 'Mô tả' });
  expectError(() => validator.validateStore({ code: '', name: 'Lớp' }), errors.store.required);
  expectError(() => validator.validateStore({ code: '   ', name: 'Lớp' }), errors.store.required);
  expectError(() => validator.validateStore({ code: 'C01', name: '   ' }), errors.store.required);
  expectError(() => validator.validateStore({ code: ` ${'x'.repeat(51)} `, name: 'Lớp' }), errors.store.codeTooLong);
  expectError(() => validator.validateStore({ code: 'C01', name: ` ${'x'.repeat(256)} ` }), errors.store.nameTooLong);
});

test('class update validation permits partial mutable fields and ignores code', () => {
  assert.deepEqual(validator.validateUpdate({ description: 'new' }), { code: undefined, name: undefined, description: 'new' });
  assert.deepEqual(validator.validateUpdate({ code: 'x'.repeat(51) }), { code: undefined, name: undefined, description: undefined });
  expectError(() => validator.validateUpdate({ name: 'x'.repeat(256) }), errors.update.nameTooLong);
  expectError(() => validator.validateUpdate({ name: '   ' }), errors.update.nameBlank);
});
