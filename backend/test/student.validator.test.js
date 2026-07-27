const test = require('node:test');
const assert = require('node:assert/strict');
const validator = require('../src/modules/student/student.validator');
const errors = require('../src/modules/student/student.errors');

const validStudent = {
  code: 'SV01',
  fullname: 'Nguyen Van A',
  email: 'a@example.com',
  username: 'nguyenvana',
  password: 'Passw0rd!',
  hobbies: 0,
};

test('student validator keeps create requirements and allows password to be omitted on update', () => {
  assert.equal(validator.validateStudent(validStudent, true, 0), null);
  assert.equal(validator.validateStudent({ fullname: 'New name', hobbies: 0 }, false, 0), null);
  assert.equal(validator.validateStudent({ ...validStudent, password: undefined }, true, 0), 'password là bắt buộc');
  assert.equal(validator.validateStudent({ password: 'short' }, false, 0), 'password phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt');
});

test('student validator preserves hobbies bitmask and error configurations', () => {
  assert.equal(validator.validateStudent({ hobbies: 0 }, false, 0), null);
  assert.equal(validator.validateStudent({ hobbies: 2 }, false, 1), 'hobbies chứa giá trị không hợp lệ (bit hobby không tồn tại hoặc đã inactive)');
  assert.deepEqual(errors.update.notFound, { statusCode: 404, errorCode: 'F604', message: 'Không tìm thấy sinh viên' });
  assert.equal(errors.uniqueMessageForConstraint('tra_student_email_key'), 'Email đã tồn tại');
});
