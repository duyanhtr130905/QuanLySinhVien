const test = require('node:test');
const assert = require('node:assert/strict');
const createListRepository = require('../src/core/database/createListRepository');

const createPool = (responses) => {
  const calls = [];
  return {
    calls,
    query: async (...args) => {
      calls.push(args.map((argument) => Array.isArray(argument) ? [...argument] : argument));
      return responses.shift();
    },
  };
};

test('list repository keeps class getAll column allowlisting and default order', async () => {
  const pool = createPool([{ rows: [{ id: 1, code: 'C01' }] }]);
  const repository = createListRepository({
    pool,
    tableName: 'tra_class',
    validColumns: ['id', 'code', 'name'],
    defaultColumns: ['id', 'code', 'name'],
    columnAliases: { id: 'id', co: 'code' },
    searchColumns: ['code', 'name'],
    defaultOrder: 'ORDER BY id ASC',
  });
  assert.deepEqual(await repository.getAll('id,unknown,code'), [{ id: 1, code: 'C01' }]);
  assert.match(pool.calls[0][0], /^SELECT id, code FROM tra_class\s+ORDER BY id ASC$/);
  assert.equal(pool.calls[0].length, 1);
});

test('list repository parameterizes class paging search and toplist while preserving page shape', async () => {
  const pool = createPool([{ rows: [{ count: '11' }] }, { rows: [{ id: 3 }] }]);
  const repository = createListRepository({
    pool,
    tableName: 'tra_class',
    validColumns: ['id', 'code', 'name', 'description'],
    defaultColumns: ['id', 'code', 'name', 'description'],
    columnAliases: { id: 'id', co: 'code' },
    searchColumns: ['code', 'name', 'description'],
    defaultOrder: 'ORDER BY id ASC',
  });
  const page = await repository.getByPage({
    page: 2, size: 5, order: 'co:1', search: "A'", columnlist: 'id,code', toplist: [3, 7],
  });
  assert.deepEqual(page, {
    page_info: { total_items: 11, total_pages: 3, current: 2, size: 5 },
    records: [{ id: 3 }],
  });
  assert.match(pool.calls[0][0], /WHERE \(code ILIKE \$1 OR name ILIKE \$1 OR description ILIKE \$1\)/);
  assert.deepEqual(pool.calls[0][1], ["%A'%"]);
  assert.match(pool.calls[1][0], /CASE WHEN id IN \(\$2, \$3\) THEN 0 ELSE 1 END,/);
  assert.match(pool.calls[1][0], /ORDER BY .*code DESC/);
  assert.deepEqual(pool.calls[1][1], ["%A'%", 3, 7, 5, 5]);
});

test('list repository applies student soft-delete base filter without exposing password columns', async () => {
  const pool = createPool([{ rows: [{ count: '0' }] }, { rows: [] }]);
  const repository = createListRepository({
    pool,
    tableName: 'tra_student',
    validColumns: ['id', 'fullname', 'email', 'deleted_at'],
    defaultColumns: ['id', 'fullname', 'email', 'deleted_at'],
    columnAliases: { fn: 'fullname' },
    searchColumns: ['fullname', 'email'],
    deletedFilter: 'deleted_at IS NULL',
    defaultOrder: 'ORDER BY id ASC',
  });
  await repository.getByPage({ page: 1, size: 10, order: undefined, search: 'An', columnlist: undefined, toplist: [] });
  assert.match(pool.calls[0][0], /WHERE deleted_at IS NULL AND \(fullname ILIKE \$1 OR email ILIKE \$1\)/);
  assert.match(pool.calls[1][0], /WHERE deleted_at IS NULL/);
  assert.doesNotMatch(pool.calls[1][0], /password/);
});
