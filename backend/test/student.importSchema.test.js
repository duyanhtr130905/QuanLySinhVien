const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const { buildFile, parseFile } = require('../src/utils/fileFormat');
const {
  STUDENT_FILE_COLUMNS, createTemplateRow, normalizeFileRow, toFileRow,
} = require('../src/modules/student/student.fileSchema');

test('student import template and exports use one ordered round-trip schema in every format', async () => {
  const exported = toFileRow({
    code: 'SV01', fullname: 'Nguyen Van A', dob: '2004-01-15', sex: false,
    class_id: 2, email: 'a@example.com', username: 'student-a',
    password: '$2b$10$never-export-a-hash', hobbies: 3,
  }, {
    classes: [{ id: 2, code: 'CTK42' }],
    hobbies: [{ name: 'Đọc sách', bit_value: 1 }, { name: 'Bóng đá', bit_value: 2 }],
  });
  const template = createTemplateRow();
  assert.deepEqual(Object.keys(template), STUDENT_FILE_COLUMNS);
  assert.deepEqual(Object.keys(exported), STUDENT_FILE_COLUMNS);
  assert.equal(exported.password, '');
  assert.equal(exported.gender, 'Nữ');
  assert.equal(exported.dob, '15/01/2004');
  assert.equal(exported.class, 'CTK42');
  assert.equal(exported.hobbies, 'Đọc sách; Bóng đá');

  for (const format of ['csv', 'xlsx', 'json', 'xml']) {
    const file = buildFile([exported], format, STUDENT_FILE_COLUMNS);
    const imported = await parseFile(file.buffer, format);
    if (format === 'xlsx') {
      const sheet = XLSX.read(file.buffer).Sheets.Students;
      assert.deepEqual(XLSX.utils.sheet_to_json(sheet, { header: 1 })[0], STUDENT_FILE_COLUMNS);
    } else if (format === 'csv') {
      assert.deepEqual(file.buffer.toString('utf8').trim().split('\n')[0].split(','), STUDENT_FILE_COLUMNS);
    } else {
      assert.deepEqual(Object.keys(imported[0]), STUDENT_FILE_COLUMNS);
    }
    assert.equal(imported[0].password, '');
  }
});

test('student file parser keeps friendly gender/date and normalizes hobbies by display name', () => {
  const parsed = normalizeFileRow({
    code: ' SV01 ', fullname: ' A ', dob: '15/01/2004', gender: 'Nam', class: ' CTK42 ',
    email: 'A@Example.com ', username: 'a', password: '',
    hobbies: ' Đọc sách ; đọc SÁCH ; BÓNG đá ',
  });
  assert.equal(parsed.gender, true);
  assert.equal(parsed.dob, '2004-01-15');
  assert.deepEqual(parsed.hobbies, ['Đọc sách', 'BÓNG đá']);
  assert.deepEqual(normalizeFileRow({ hobbies: [' Đọc sách ', 'Bóng đá; đọc SÁCH'] }).hobbies, ['Đọc sách', 'Bóng đá']);
  assert.deepEqual(normalizeFileRow({ gender: 'False' }).gender, false);
  assert.deepEqual(normalizeFileRow({ gender: '1' }).gender, true);
});
