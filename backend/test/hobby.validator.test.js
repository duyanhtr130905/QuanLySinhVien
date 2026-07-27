const test = require('node:test');
const assert = require('node:assert/strict');
const AppError = require('../src/core/http/AppError');
const validator = require('../src/modules/hobby/hobby.validator');
const errors = require('../src/modules/hobby/hobby.errors');

const expectError = (fn, expected) => assert.throws(
  fn,
  (error) => error instanceof AppError
    && error.statusCode === expected.statusCode
    && error.errorCode === expected.errorCode
    && error.message === expected.message
);

test('hobby errors retain response codes and map all unique constraints', () => {
  assert.deepEqual(errors.store.invalidName, {
    statusCode: 400,
    errorCode: 'E603',
    message: 'name là bắt buộc và không được để trống',
  });
  assert.deepEqual(errors.destroy.inUse, {
    statusCode: 409,
    errorCode: 'G605',
    message: 'Không thể xóa: sở thích này đang được sinh viên sử dụng',
  });
  assert.equal(errors.uniqueMessageForConstraint('tra_hobby_name_key'), 'Tên sở thích đã tồn tại');
  assert.equal(errors.uniqueMessageForConstraint('tra_hobby_code_key'), 'Mã sở thích đã tồn tại');
  assert.equal(errors.uniqueMessageForConstraint('tra_hobby_bit_value_key'), 'Xung đột dữ liệu nội bộ (bit_value trùng), vui lòng thử lại');
  assert.equal(errors.uniqueMessageForConstraint('unknown'), 'Dữ liệu đã tồn tại (vi phạm ràng buộc UNIQUE)');
  assert.equal(Object.isFrozen(errors.destroy), true);
});

test('hobby store validator trims only after retaining current required and length validation', () => {
  const body = { name: '  Đọc sách  ' };
  assert.equal(validator.validateStore(body), 'Đọc sách');
  assert.deepEqual(body, { name: '  Đọc sách  ' });
  expectError(() => validator.validateStore({ name: '' }), errors.store.invalidName);
  expectError(() => validator.validateStore({ name: '   ' }), errors.store.invalidName);
  expectError(() => validator.validateStore({ name: ` ${'x'.repeat(31)} ` }), errors.store.nameTooLong);
});

test('hobby destroy id validator accepts legacy parseInt inputs and reports its existing error config', () => {
  assert.equal(validator.parseDestroyId('7suffix'), 7);
  expectError(() => validator.parseDestroyId('bad'), errors.destroy.invalidId);
});
