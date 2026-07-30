const test = require('node:test');
const assert = require('node:assert/strict');

const loadService = (pool) => {
  const servicePath = require.resolve('../src/modules/student/student.service.js');
  const dbPath = require.resolve('../src/config/db');
  const previousDb = require.cache[dbPath];
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: pool };
  delete require.cache[servicePath];
  const service = require(servicePath);
  delete require.cache[servicePath];
  if (previousDb) require.cache[dbPath] = previousDb;
  else delete require.cache[dbPath];
  return service;
};

const validDraft = (overrides = {}) => ({
  draftKey: 'row-1', rowNumber: 2, values: {
    code: 'SV01', fullname: 'Nguyen Van A', dob: '15/01/2004', gender: 'Nam',
    class: 'CTK42', email: 'a@example.com', username: 'student-a', password: 'Aa1!abcd',
    hobbies: 'Đọc sách; Bóng đá', ...overrides,
  },
});

test('student import validation batches database checks and maps duplicate and missing hobby errors to fields', async () => {
  const calls = [];
  const service = loadService({
    query: async (...args) => {
      calls.push(args);
      const sql = args[0];
      if (sql.includes('FROM tra_class')) return { rows: [{ id: 2, code: 'CTK42' }] };
      if (sql.includes('FROM tra_hobby')) return { rows: [{ id: 1, name: 'Đọc sách', bit_value: 1 }] };
      if (sql.includes('FROM tra_student')) return { rows: [{ id: 7, code: 'SV99', email: 'taken@example.com', username: 'taken' }] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  });
  const result = await service.validateImportDrafts([
    validDraft({ email: 'taken@example.com', hobbies: 'Đọc sách; Chess' }),
    { ...validDraft({ code: 'SV01', username: 'taken', password: '' }), draftKey: 'row-2', rowNumber: 3 },
  ]);
  assert.equal(calls.length, 3);
  assert.ok(result.rows[0].errors.code);
  assert.ok(result.rows[0].errors.email);
  assert.match(result.rows[0].errors.hobbies, /Chess/);
  assert.ok(result.rows[1].errors.code);
  assert.ok(result.rows[1].errors.username);
  assert.equal(result.rows[0].fieldErrors, result.rows[0].errors);
});

test('student import commit validates in its transaction and rolls back before any write', async () => {
  const calls = [];
  const client = {
    query: async (...args) => {
      calls.push(args);
      const sql = args[0];
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM tra_class')) return { rows: [{ id: 2, code: 'CTK42' }] };
      if (sql.includes('FROM tra_hobby')) return { rows: [{ id: 1, name: 'Đọc sách', bit_value: 1 }] };
      if (sql.includes('FROM tra_student')) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release: () => {},
  };
  const service = loadService({ query: async () => ({ rows: [] }), connect: async () => client });
  await assert.rejects(() => service.commitImportDrafts([validDraft({ password: '', hobbies: 'Missing hobby' })]), error => error.code === 'IMPORT_VALIDATION');
  assert.equal(calls.some(([sql]) => /^INSERT|^UPDATE/.test(sql)), false);
  assert.equal(calls.some(([sql]) => sql === 'ROLLBACK'), true);
});

test('student import update keeps an empty password and converts hobby names to the stored bitmask', async () => {
  const calls = [];
  const client = {
    query: async (...args) => {
      calls.push(args);
      const sql = args[0];
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('FROM tra_class')) return { rows: [{ id: 2, code: 'CTK42' }] };
      if (sql.includes('FROM tra_hobby')) return { rows: [{ id: 1, name: 'Đọc sách', bit_value: 1 }, { id: 2, name: 'Bóng đá', bit_value: 2 }] };
      if (sql.includes('FOR UPDATE')) return { rows: [{ id: 7, code: 'SV01' }] };
      if (sql.includes('SELECT id, code, email, username')) return { rows: [{ id: 7, code: 'SV01', email: 'a@example.com', username: 'student-a' }] };
      if (sql.startsWith('UPDATE tra_student')) return { rows: [{ id: 7, code: 'SV01' }] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release: () => {},
  };
  const service = loadService({ query: async () => ({ rows: [] }), connect: async () => client });
  const result = await service.commitImportDrafts([validDraft({ password: '', hobbies: 'đọc SÁCH; Bóng đá' })]);
  const update = calls.find(([sql]) => sql.startsWith('UPDATE tra_student'));
  assert.equal(result.updated.length, 1);
  assert.doesNotMatch(update[0], /password =/);
  assert.match(update[0], /username = \$6/);
  assert.equal(update[1][8], 3);
});
