const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeMultipartBody } = require('../src/modules/student/student.multipart');

test('student multipart normalization preserves sex=false, class_id null, hobbies=0, and optional fields', () => {
  const body = {
    sex: 'false',
    class_id: '-1',
    hobbies: '',
    fullname: 'Nguyen Van A',
    facebook: '',
  };
  const parsed = normalizeMultipartBody(body);
  assert.deepEqual(parsed, {
    sex: false,
    class_id: null,
    hobbies: 0,
    fullname: 'Nguyen Van A',
    facebook: '',
  });
  assert.deepEqual(body, {
    sex: 'false',
    class_id: '-1',
    hobbies: '',
    fullname: 'Nguyen Van A',
    facebook: '',
  });
});

test('student multipart normalization retains already-typed JSON values', () => {
  const parsed = normalizeMultipartBody({ sex: false, class_id: null, hobbies: 0 });
  assert.deepEqual(parsed, { sex: false, class_id: null, hobbies: 0 });
});
