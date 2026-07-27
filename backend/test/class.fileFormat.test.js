const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFile, buildFile } = require('../src/utils/fileFormat');

test('Class import/export supports csv, xlsx, json, and xml through the shared file formatter', async () => {
  const rows = [{ code: 'C01', name: 'Class 1', description: 'Imported class' }];
  for (const type of ['csv', 'xlsx', 'json', 'xml']) {
    const built = buildFile(rows, type);
    assert.equal(built.extension, type);
    assert.ok(Buffer.isBuffer(built.buffer));
    assert.ok(built.contentType);

    const parsed = await parseFile(built.buffer, type);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].code, 'C01');
    assert.equal(parsed[0].name, 'Class 1');
  }
});
