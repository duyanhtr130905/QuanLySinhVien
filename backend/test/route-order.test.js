const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routeSource = (moduleName) => fs.readFileSync(
  path.join(__dirname, '..', 'src', 'modules', moduleName, `${moduleName}.routes.js`),
  'utf8'
);

const assertBefore = (source, first, second) => {
  assert.ok(source.indexOf(first) >= 0, `missing route declaration: ${first}`);
  assert.ok(source.indexOf(second) >= 0, `missing route declaration: ${second}`);
  assert.ok(source.indexOf(first) < source.indexOf(second), `${first} must precede ${second}`);
};

test('student fixed paths remain ahead of dynamic :id routes', () => {
  const source = routeSource('student');

  assertBefore(source, "router.get('/deleted/page'", "router.get('/:id'");
  assertBefore(source, "router.post('/copy/preview'", "router.post('/copy/:id'");
  assertBefore(source, "router.post('/copy/commit'", "router.post('/copy/:id'");
  assertBefore(source, "router.get('/import/template'", "router.get('/:id'");
  assertBefore(source, "router.get('/export/:id'", "router.get('/:id'");
});

test('class membership and fixed paths remain ahead of class :id routes', () => {
  const source = routeSource('class');

  assertBefore(source, "router.delete('/delete'", "router.delete('/:id'");
  assertBefore(source, "router.post('/copy/commit'", "router.post('/copy/:id'");
  assertBefore(source, "router.get('/:id/students'", "router.get('/:id'");
  assertBefore(source, "router.delete('/:id/students/:studentId'", "router.delete('/:id'");
});
