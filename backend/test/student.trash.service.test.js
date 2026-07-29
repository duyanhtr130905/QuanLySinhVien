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

test('student deleted list only selects soft-deleted rows and never exposes password', async () => {
  const calls = [];
  const service = loadService({
    query: async (...args) => {
      calls.push(args);
      return calls.length === 1 ? { rows: [{ count: '1' }] } : { rows: [{ id: 4, deleted_at: '2026-01-01' }] };
    },
  });
  const result = await service.getDeletedByPage({ page: 1, size: 10, order: undefined, search: 'An', columnlist: undefined, toplist: [] });
  assert.deepEqual(result.records, [{ id: 4, deleted_at: '2026-01-01' }]);
  assert.match(calls[0][0], /WHERE deleted_at IS NOT NULL AND \(fullname ILIKE \$1 OR description ILIKE \$1 OR email ILIKE \$1\)/);
  assert.doesNotMatch(calls[1][0], /password/);
});

test('student restore de-duplicates IDs, restores deleted rows, and reports missing rows', async () => {
  const calls = [];
  const client = {
    query: async (...args) => {
      calls.push(args);
      const sql = args[0];
      if (sql === 'BEGIN' || sql === 'SAVEPOINT restore_student' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('SELECT id, code, email, username')) {
        return args[1][0] === 4
          ? { rows: [{ id: 4, code: 'SV04', email: 'sv04@example.com', username: 'sv04' }] }
          : { rows: [] };
      }
      if (sql.includes('SELECT code, email, username')) return { rows: [] };
      if (sql.startsWith('UPDATE tra_student SET deleted_at = NULL')) return { rows: [{ id: 4 }] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release: () => {},
  };
  const service = loadService({ query: async () => ({ rows: [] }), connect: async () => client });
  assert.deepEqual(await service.restoreDeleted([4, '4', 8]), {
    restored: [4], notFound: [8], conflicts: [],
  });
  assert.match(calls.find(([sql]) => sql.includes('SELECT id, code, email, username'))[0], /deleted_at IS NOT NULL/);
});

test('student permanent delete only deletes soft-deleted rows and cleans unshared attachments after commit', async () => {
  const calls = [];
  const client = {
    query: async (...args) => {
      calls.push(args);
      const sql = args[0];
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('DELETE FROM tra_student')) {
        return args[1][0] === 4
          ? { rows: [{ id: 4, attachment: 'https://storage/student-attachments/students/SV04.png' }] }
          : { rows: [] };
      }
      if (sql.startsWith('SELECT COUNT(*) AS count')) return { rows: [{ count: '0' }] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release: () => {},
  };
  const service = loadService({ query: async () => ({ rows: [] }), connect: async () => client });
  assert.deepEqual(await service.permanentlyDelete([4, 8, 4]), {
    deleted: [4],
    notFound: [8],
    attachmentsToDelete: ['https://storage/student-attachments/students/SV04.png'],
  });
  assert.match(calls.find(([sql]) => sql.includes('DELETE FROM tra_student'))[0], /deleted_at IS NOT NULL/);
});
