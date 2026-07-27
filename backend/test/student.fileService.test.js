const test = require('node:test');
const assert = require('node:assert/strict');
const fileService = require('../src/modules/student/student.fileService');

const image = { mimetype: 'image/png', size: 4, originalname: 'avatar.png', buffer: Buffer.from('file') };

test('student file service validates metadata and delegates a create upload', async () => {
  const calls = [];
  const storage = {
    uploadAttachment: async (...args) => { calls.push(args); return 'https://storage/new.png'; },
  };
  assert.equal(await fileService.prepareCreateAttachment(undefined, 'SV01', storage), null);
  assert.equal(await fileService.prepareCreateAttachment(image, 'SV01', storage), 'https://storage/new.png');
  assert.deepEqual(calls, [[image, 'SV01']]);
  assert.throws(
    () => fileService.validateImageMetadata({ ...image, mimetype: 'application/pdf' }),
    (error) => error.code === 'INVALID_FILE_METADATA'
  );
  assert.throws(
    () => fileService.validateImageMetadata({ ...image, size: 5 * 1024 * 1024 + 1 }),
    (error) => error.code === 'INVALID_FILE_METADATA'
  );
});

test('student file service preserves update upload and cleanup order', async () => {
  const calls = [];
  const storage = {
    getAttachmentById: async (id) => { calls.push(['get', id]); return 'https://storage/old.png'; },
    uploadAttachment: async (file, key) => { calls.push(['upload', file, key]); return 'https://storage/new.png'; },
    deleteAttachment: async (url) => { calls.push(['delete', url]); },
  };
  const attachment = await fileService.prepareUpdateAttachment(image, 4, storage);
  assert.deepEqual(attachment, {
    oldAttachmentUrl: 'https://storage/old.png',
    newAttachmentUrl: 'https://storage/new.png',
  });
  await fileService.cleanupOldAttachmentAfterUpdate(attachment, storage);
  await fileService.cleanupNewAttachment('https://storage/new.png', storage);
  assert.deepEqual(calls, [
    ['get', 4],
    ['upload', image, 'id4'],
    ['delete', 'https://storage/old.png'],
    ['delete', 'https://storage/new.png'],
  ]);
});
