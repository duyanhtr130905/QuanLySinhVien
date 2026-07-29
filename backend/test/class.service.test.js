const test = require('node:test');
const assert = require('node:assert/strict');

const loadService = (pool) => {
  const servicePath = require.resolve('../src/modules/class/class.service.js');
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

test('class lists calculate student_count in the list SQL without N+1 queries', async () => {
  const calls = [];
  const pool = {
    query: async (...args) => {
      calls.push(args);
      if (calls.length === 1) return { rows: [{ id: 1, code: 'C01', student_count: '2' }] };
      if (calls.length === 2) return { rows: [{ count: '1' }] };
      return { rows: [{ id: 1, student_count: '2' }] };
    },
  };
  const service = loadService(pool);
  assert.deepEqual(await service.getAll(), [{ id: 1, code: 'C01', student_count: '2' }]);
  assert.equal(calls.length, 1);
  assert.match(calls[0][0], /SELECT COUNT\(\*\).*tra_student student/s);
  assert.match(calls[0][0], /student\.class_id = tra_class\.id AND student\.deleted_at IS NULL/);

  const page = await service.getByPage({ page: 1, size: 10, order: undefined, search: undefined, columnlist: undefined, toplist: [] });
  assert.equal(calls.length, 3);
  assert.deepEqual(page.page_info, { total_items: 1, total_pages: 1, current: 1, size: 10 });
  assert.match(calls[2][0], /SELECT COUNT\(\*\).*tra_student student/s);
});

test('class student list filters class_id and soft-deleted students with one count query and one data query', async () => {
  const calls = [];
  const pool = {
    query: async (...args) => {
      calls.push(args.map((argument) => Array.isArray(argument) ? [...argument] : argument));
      if (calls.length === 1) return { rows: [{ '?column?': 1 }] };
      if (calls.length === 2) return { rows: [{ count: '1' }] };
      return { rows: [{ id: 2, fullname: 'An' }] };
    },
  };
  const service = loadService(pool);
  const result = await service.getStudentsByClass(7, {
    page: 1, size: 5, order: 'fn:1', search: 'An', columnlist: 'id,fullname',
  });
  assert.deepEqual(result, {
    page_info: { total_items: 1, total_pages: 1, current: 1, size: 5 },
    records: [{ id: 2, fullname: 'An' }],
  });
  assert.equal(calls.length, 3);
  assert.match(calls[1][0], /class_id = \$1 AND deleted_at IS NULL/);
  assert.match(calls[1][0], /code ILIKE \$2 OR fullname ILIKE \$2 OR email ILIKE \$2 OR username ILIKE \$2 OR description ILIKE \$2/);
  assert.deepEqual(calls[1][1], [7, '%An%']);
});

test('class available-student list returns only active unassigned students with allowlisted fields', async () => {
  const calls = [];
  const pool = {
    query: async (...args) => {
      calls.push(args.map((argument) => Array.isArray(argument) ? [...argument] : argument));
      if (calls.length === 1) return { rows: [{ '?column?': 1 }] };
      if (calls.length === 2) return { rows: [{ count: '1' }] };
      return { rows: [{ id: 2, code: 'SV02', fullname: 'An', class_id: null }] };
    },
  };
  const service = loadService(pool);
  const result = await service.getAvailableStudentsByClass(7, {
    page: 1, size: 5, order: 'fn:1', search: 'An', columnlist: 'id,code,fullname,password', toplist: [],
  });

  assert.deepEqual(result, {
    page_info: { total_items: 1, total_pages: 1, current: 1, size: 5 },
    records: [{ id: 2, code: 'SV02', fullname: 'An', class_id: null }],
  });
  assert.equal(calls.length, 3);
  assert.match(calls[1][0], /class_id IS NULL AND deleted_at IS NULL/);
  assert.match(calls[1][0], /code ILIKE \$1 OR fullname ILIKE \$1 OR email ILIKE \$1 OR username ILIKE \$1 OR description ILIKE \$1/);
  assert.deepEqual(calls[1][1], ['%An%']);
  assert.doesNotMatch(calls[2][0], /password/);
  assert.match(calls[2][0], /ORDER BY\s+fullname DESC/);
});

test('class available-student list does not query students when the class is missing', async () => {
  const calls = [];
  const service = loadService({
    query: async (...args) => {
      calls.push(args);
      return { rows: [] };
    },
  });
  const result = await service.getAvailableStudentsByClass(404, {
    page: 1, size: 10, order: undefined, search: undefined, columnlist: undefined, toplist: [],
  });
  assert.equal(result, null);
  assert.equal(calls.length, 1);
  assert.match(calls[0][0], /SELECT 1 FROM tra_class WHERE id = \$1/);
});

test('class.assignStudents commits only after every student is unassigned and active', async () => {
  const calls = [];
  let released = false;
  const client = {
    query: async (...args) => {
      calls.push(args);
      const sql = args[0];
      if (sql === 'SELECT id FROM tra_class WHERE id = $1 FOR UPDATE') return { rows: [{ id: 7 }] };
      if (sql.startsWith('SELECT id, class_id, deleted_at')) {
        return { rows: [{ id: 1, class_id: null, deleted_at: null }, { id: 2, class_id: null, deleted_at: null }] };
      }
      return { rows: [] };
    },
    release: () => { released = true; },
  };
  const service = loadService({ query: async () => ({ rows: [] }), connect: async () => client });
  assert.deepEqual(await service.assignStudents(7, [1, 2]), [1, 2]);
  assert.equal(calls[0][0], 'BEGIN');
  assert.match(calls[3][0], /^UPDATE tra_student SET class_id = \$1/);
  assert.equal(calls[4][0], 'COMMIT');
  assert.equal(released, true);
});

test('class.assignStudents normalizes string IDs from PostgreSQL before validating requested students', async () => {
  const calls = [];
  const client = {
    query: async (...args) => {
      calls.push(args);
      const sql = args[0];
      if (sql === 'SELECT id FROM tra_class WHERE id = $1 FOR UPDATE') return { rows: [{ id: '7' }] };
      if (sql.startsWith('SELECT id, class_id, deleted_at')) {
        return { rows: [{ id: '1', class_id: null, deleted_at: null }, { id: '2', class_id: null, deleted_at: null }] };
      }
      return { rows: [] };
    },
    release: () => {},
  };
  const service = loadService({ query: async () => ({ rows: [] }), connect: async () => client });
  assert.deepEqual(await service.assignStudents('7', [1, '2', 1]), [1, 2]);
  assert.deepEqual(calls[2][1], [[1, 2]]);
  assert.deepEqual(calls[3][1], [7, [1, 2]]);
});

test('class.assignStudents rolls back every update when one requested student is missing', async () => {
  const calls = [];
  const client = {
    query: async (...args) => {
      calls.push(args);
      const sql = args[0];
      if (sql === 'SELECT id FROM tra_class WHERE id = $1 FOR UPDATE') return { rows: [{ id: 7 }] };
      if (sql.startsWith('SELECT id, class_id, deleted_at')) return { rows: [{ id: '1', class_id: null, deleted_at: null }] };
      return { rows: [] };
    },
    release: () => {},
  };
  const service = loadService({ query: async () => ({ rows: [] }), connect: async () => client });
  await assert.rejects(() => service.assignStudents(7, [1, 2]), (error) => error.statusCode === 404 && error.errorCode === 'L605');
  assert.equal(calls.at(-1)[0], 'ROLLBACK');
  assert.equal(calls.some(([sql]) => typeof sql === 'string' && sql.startsWith('UPDATE tra_student')), false);
});

test('class.assignStudents rolls back when a student already belongs to a class', async () => {
  const calls = [];
  let released = false;
  const client = {
    query: async (...args) => {
      calls.push(args);
      const sql = args[0];
      if (sql === 'SELECT id FROM tra_class WHERE id = $1 FOR UPDATE') return { rows: [{ id: 7 }] };
      if (sql.startsWith('SELECT id, class_id, deleted_at')) return { rows: [{ id: 1, class_id: 3, deleted_at: null }] };
      return { rows: [] };
    },
    release: () => { released = true; },
  };
  const service = loadService({ query: async () => ({ rows: [] }), connect: async () => client });
  await assert.rejects(() => service.assignStudents(7, [1]), (error) => error.statusCode === 409 && error.errorCode === 'L607');
  assert.equal(calls.at(-1)[0], 'ROLLBACK');
  assert.equal(calls.some(([sql]) => typeof sql === 'string' && sql.startsWith('UPDATE tra_student')), false);
  assert.equal(released, true);
});

test('class.assignStudents rolls back when a requested student is soft-deleted', async () => {
  const calls = [];
  const client = {
    query: async (...args) => {
      calls.push(args);
      const sql = args[0];
      if (sql === 'SELECT id FROM tra_class WHERE id = $1 FOR UPDATE') return { rows: [{ id: 7 }] };
      if (sql.startsWith('SELECT id, class_id, deleted_at')) return { rows: [{ id: 1, class_id: null, deleted_at: new Date() }] };
      return { rows: [] };
    },
    release: () => {},
  };
  const service = loadService({ query: async () => ({ rows: [] }), connect: async () => client });
  await assert.rejects(() => service.assignStudents(7, [1]), (error) => error.statusCode === 409 && error.errorCode === 'L606');
  assert.equal(calls.at(-1)[0], 'ROLLBACK');
});

test('class.removeStudent only clears class_id and never deletes the student', async () => {
  const calls = [];
  const pool = {
    query: async (...args) => {
      calls.push(args);
      if (calls.length === 1) return { rows: [{ '?column?': 1 }] };
      if (calls.length === 2) return { rows: [{ id: 3, class_id: 7 }] };
      return { rows: [{ id: 3 }] };
    },
  };
  const service = loadService(pool);
  assert.deepEqual(await service.removeStudent(7, 3), { studentId: 3 });
  assert.match(calls[2][0], /^UPDATE tra_student SET class_id = NULL, updated_at = NOW\(\)/);
  assert.doesNotMatch(calls[2][0], /DELETE FROM tra_student/);
  assert.deepEqual(calls[2][1], [3, 7]);
});

test('class.removeStudents clears many class links atomically without deleting students', async () => {
  const calls = [];
  let released = false;
  const client = {
    query: async (...args) => {
      calls.push(args);
      const sql = args[0];
      if (sql === 'SELECT id FROM tra_class WHERE id = $1 FOR UPDATE') return { rows: [{ id: 7 }] };
      if (sql.startsWith('SELECT id, class_id, deleted_at')) {
        return { rows: [{ id: '1', class_id: '7', deleted_at: null }, { id: 2, class_id: 7, deleted_at: null }] };
      }
      if (sql.startsWith('UPDATE tra_student')) return { rows: [{ id: 1 }, { id: 2 }] };
      return { rows: [] };
    },
    release: () => { released = true; },
  };
  const service = loadService({ query: async () => ({ rows: [] }), connect: async () => client });
  assert.deepEqual(await service.removeStudents(7, [1, '2', 1]), [1, 2]);
  assert.equal(calls[0][0], 'BEGIN');
  assert.match(calls[3][0], /^UPDATE tra_student SET class_id = NULL/);
  assert.doesNotMatch(calls[3][0], /DELETE FROM tra_student/);
  assert.deepEqual(calls[3][1], [[1, 2], 7]);
  assert.equal(calls[4][0], 'COMMIT');
  assert.equal(released, true);
});

test('class.removeStudents rolls back when any student is outside the class', async () => {
  const calls = [];
  const client = {
    query: async (...args) => {
      calls.push(args);
      const sql = args[0];
      if (sql === 'SELECT id FROM tra_class WHERE id = $1 FOR UPDATE') return { rows: [{ id: 7 }] };
      if (sql.startsWith('SELECT id, class_id, deleted_at')) return { rows: [{ id: 1, class_id: 7, deleted_at: null }, { id: 2, class_id: 8, deleted_at: null }] };
      return { rows: [] };
    },
    release: () => {},
  };
  const service = loadService({ query: async () => ({ rows: [] }), connect: async () => client });
  await assert.rejects(() => service.removeStudents(7, [1, 2]), (error) => error.statusCode === 409 && error.errorCode === 'L608');
  assert.equal(calls.at(-1)[0], 'ROLLBACK');
  assert.equal(calls.some(([sql]) => typeof sql === 'string' && sql.startsWith('UPDATE tra_student')), false);
});

test('class.removeStudent compares normalized PostgreSQL class_id values', async () => {
  const calls = [];
  const pool = {
    query: async (...args) => {
      calls.push(args);
      if (calls.length === 1) return { rows: [{ '?column?': 1 }] };
      if (calls.length === 2) return { rows: [{ id: '3', class_id: '7' }] };
      return { rows: [{ id: '3' }] };
    },
  };
  const service = loadService(pool);
  assert.deepEqual(await service.removeStudent(7, 3), { studentId: '3' });
  assert.deepEqual(calls[2][1], [3, 7]);
});

test('class.removeStudent rejects a student assigned to a different class', async () => {
  const calls = [];
  const pool = {
    query: async (...args) => {
      calls.push(args);
      if (calls.length === 1) return { rows: [{ '?column?': 1 }] };
      return { rows: [{ id: 3, class_id: '8' }] };
    },
  };
  const service = loadService(pool);
  await assert.rejects(() => service.removeStudent(7, 3), (error) => error.statusCode === 409 && error.errorCode === 'L608');
  assert.equal(calls.length, 2);
});

test('class.removeStudent reports a missing active student', async () => {
  const pool = {
    query: async (...args) => (args[0].startsWith('SELECT 1') ? { rows: [{ '?column?': 1 }] } : { rows: [] }),
  };
  const service = loadService(pool);
  await assert.rejects(() => service.removeStudent(7, 3), (error) => error.statusCode === 404 && error.errorCode === 'L605');
});
