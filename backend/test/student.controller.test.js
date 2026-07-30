const test = require('node:test');
const assert = require('node:assert/strict');
const { loadController, makeReq, makeRes, expectApiResponse, makeNext } = require('./controllerTestHelpers');

const controllerFor = (serviceMock, fileFormatMock) => loadController({
  controller: '../src/modules/student/student.controller.js',
  service: '../src/modules/student/student.service.js',
  serviceMock,
  dependencies: fileFormatMock ? { '../src/utils/fileFormat.js': fileFormatMock } : {},
});

const validStudent = {
  code: 'SV01', fullname: 'Nguyen Van A', email: 'a@example.com', username: 'nguyenvana',
  password: 'Passw0rd!', hobbies: 0,
};

test('student.getAll forwards columnlist and wraps the service payload', async () => {
  const calls = [];
  const controller = controllerFor({ getAll: async (...args) => { calls.push(args); return [{ id: 1 }]; } });
  const res = makeRes();
  await controller.getAll(makeReq({ query: { columnlist: 'id,fullname' } }), res, makeNext());
  expectApiResponse(res, 200, '200', 'Lấy danh sách sinh viên thành công', [{ id: 1 }]);
  assert.deepEqual(calls, [['id,fullname']]);
});

test('student.getById parses id and returns the current detail response', async () => {
  const calls = [];
  const controller = controllerFor({ getOneById: async (...args) => { calls.push(args); return { id: 7, fullname: 'A' }; } });
  const res = makeRes();
  await controller.getById(makeReq({ params: { id: '7' } }), res, makeNext());
  expectApiResponse(res, 200, '200', 'Lấy chi tiết sinh viên thành công', { id: 7, fullname: 'A' });
  assert.deepEqual(calls, [[7]]);
});

test('student.getByPage rejects bad paging parameters before service access', async () => {
  let called = false;
  const controller = controllerFor({ getByPage: async () => { called = true; } });
  const pageRes = makeRes();
  await controller.getByPage(makeReq({ query: { page: '', size: '5' } }), pageRes, makeNext());
  expectApiResponse(pageRes, 400, 'C601', 'Số trang không hợp lệ', null);
  const sizeRes = makeRes();
  await controller.getByPage(makeReq({ query: { page: '1', size: 'no' } }), sizeRes, makeNext());
  expectApiResponse(sizeRes, 400, 'C602', 'Cỡ trang không hợp lệ', null);
  assert.equal(called, false);
});

test('student.getByPage parses toplist and excluded IDs before forwarding the service object', async () => {
  const calls = [];
  const data = { page_info: { current: 1 }, records: [] };
  const controller = controllerFor({ getByPage: async (...args) => { calls.push(args); return data; } });
  const res = makeRes();
  await controller.getByPage(makeReq({ query: { page: '1', size: '10', toplist: '2, x, 5', exclude_ids: '1, bad, 3x', search: 'An' } }), res, makeNext());
  expectApiResponse(res, 200, '200', 'Lấy danh sách sinh viên theo trang thành công', data);
  assert.deepEqual(calls, [[{ page: 1, size: 10, order: undefined, search: 'An', columnlist: undefined, toplist: [2, 5], excludeIds: [1, 3] }]]);
});

test('student.getByPage accepts legacy bracket-array exclusion parameters', async () => {
  const calls = [];
  const controller = controllerFor({ getByPage: async (...args) => { calls.push(args); return { page_info: {}, records: [] }; } });
  await controller.getByPage(makeReq({ query: { page: '1', size: '10', 'exclude_ids[]': ['4', 'bad', '6x'] } }), makeRes(), makeNext());
  assert.deepEqual(calls, [[{ page: 1, size: 10, order: undefined, search: undefined, columnlist: undefined, toplist: [], excludeIds: [4, 6] }]]);
});

test('student trash endpoints keep page, restore, permanent-delete, and partial-success contracts', async () => {
  const pageCalls = [];
  const page = controllerFor({ getDeletedByPage: async (...args) => { pageCalls.push(args); return { page_info: { current: 1 }, records: [{ id: 4, deleted_at: '2026-01-01' }] }; } });
  const pageRes = makeRes();
  await page.getDeletedByPage(makeReq({ query: { page: '1', size: '10' } }), pageRes, makeNext());
  expectApiResponse(pageRes, 200, '200', 'Lấy danh sách sinh viên đã xóa thành công', { page_info: { current: 1 }, records: [{ id: 4, deleted_at: '2026-01-01' }] });
  assert.deepEqual(pageCalls, [[{ page: 1, size: 10, order: undefined, search: undefined, columnlist: undefined, toplist: [] }]]);

  const restoreCalls = [];
  const restore = controllerFor({ restoreDeleted: async (...args) => { restoreCalls.push(args); return { restored: [4], notFound: [8], conflicts: [9] }; } });
  const restoreRes = makeRes();
  await restore.restoreDeleted(makeReq({ body: { idlist: [4, 8, 9] } }), restoreRes, makeNext());
  expectApiResponse(restoreRes, 200, '200', 'Đã khôi phục 1 sinh viên', { restored: [4], notFound: [8], conflicts: [9] });
  assert.deepEqual(restoreCalls, [[[4, 8, 9]]]);

  const deletedAttachments = [];
  const permanent = controllerFor({
    permanentlyDelete: async () => ({ deleted: [4], notFound: [8], attachmentsToDelete: ['https://storage/a.png'] }),
    deleteAttachment: async (url) => { deletedAttachments.push(url); },
  });
  const permanentRes = makeRes();
  await permanent.permanentlyDelete(makeReq({ body: { idlist: [4, 8] } }), permanentRes, makeNext());
  expectApiResponse(permanentRes, 200, '200', 'Đã xóa vĩnh viễn 1 sinh viên', { deleted: [4], notFound: [8] });
  assert.deepEqual(deletedAttachments, ['https://storage/a.png']);
});

test('student.store validates before upload/store while still fetching the active hobby mask', async () => {
  let stored = false;
  const controller = controllerFor({
    getActiveHobbyMask: async () => 0,
    store: async () => { stored = true; },
    uploadAttachment: async () => { throw new Error('must not upload'); },
  });
  const res = makeRes();
  await controller.store(makeReq({ body: { ...validStudent, email: 'invalid-email' } }), res, makeNext());
  expectApiResponse(res, 400, 'E603', 'email không đúng định dạng', null);
  assert.equal(stored, false);
});

test('student.store normalizes multipart sex=false, class_id null, and hobbies=0 before saving', async () => {
  const calls = [];
  const controller = controllerFor({
    getActiveHobbyMask: async () => 0,
    store: async (...args) => { calls.push(args); return { id: 10 }; },
  });
  const res = makeRes();
  await controller.store(makeReq({
    body: { ...validStudent, sex: 'false', class_id: '-1', hobbies: '' },
  }), res, makeNext());
  expectApiResponse(res, 200, '200', 'Tạo sinh viên thành công', { id: 10 });
  assert.deepEqual(calls, [[{
    ...validStudent,
    sex: false,
    class_id: null,
    hobbies: 0,
    attachment: null,
  }]]);
});

test('student.update validates a partial body before it updates', async () => {
  let updated = false;
  const controller = controllerFor({
    getActiveHobbyMask: async () => 0,
    update: async () => { updated = true; },
  });
  const res = makeRes();
  await controller.update(makeReq({ params: { id: '4' }, body: { fullname: '   ' } }), res, makeNext());
  expectApiResponse(res, 400, 'F603', 'fullname không được để trống', null);
  assert.equal(updated, false);
});

test('student.update keeps password optional and forwards normalized multipart values', async () => {
  const calls = [];
  const controller = controllerFor({
    getActiveHobbyMask: async () => 0,
    update: async (...args) => { calls.push(args); return { id: 4 }; },
  });
  const res = makeRes();
  await controller.update(makeReq({
    params: { id: '4' },
    body: { fullname: 'New name', sex: 'false', class_id: '', hobbies: '0' },
  }), res, makeNext());
  expectApiResponse(res, 200, '200', 'Cập nhật sinh viên thành công', { id: 4 });
  assert.deepEqual(calls, [[4, { fullname: 'New name', sex: false, class_id: null, hobbies: 0 }]]);
});

test('student.store cleans up a newly uploaded attachment when the database write fails', async () => {
  const deleted = [];
  const databaseError = new Error('insert failed');
  const controller = controllerFor({
    getActiveHobbyMask: async () => 0,
    uploadAttachment: async () => 'https://storage/new.png',
    store: async () => { throw databaseError; },
    deleteAttachment: async (url) => { deleted.push(url); },
  });
  const next = makeNext();
  await controller.store(makeReq({
    body: validStudent,
    file: { mimetype: 'image/png', size: 3, originalname: 'new.png', buffer: Buffer.from('x') },
  }), makeRes(), next);
  assert.deepEqual(deleted, ['https://storage/new.png']);
  assert.deepEqual(next.calls, [databaseError]);
  assert.equal(databaseError.fallbackCode, 'E600');
});

test('student.update cleans up a newly uploaded attachment when the database write fails', async () => {
  const deleted = [];
  const databaseError = new Error('update failed');
  const controller = controllerFor({
    getActiveHobbyMask: async () => 0,
    getAttachmentById: async () => 'https://storage/old.png',
    uploadAttachment: async () => 'https://storage/new.png',
    update: async () => { throw databaseError; },
    deleteAttachment: async (url) => { deleted.push(url); },
  });
  const next = makeNext();
  await controller.update(makeReq({
    params: { id: '4' },
    body: { fullname: 'New name' },
    file: { mimetype: 'image/jpeg', size: 3, originalname: 'new.jpg', buffer: Buffer.from('x') },
  }), makeRes(), next);
  assert.deepEqual(deleted, ['https://storage/new.png']);
  assert.deepEqual(next.calls, [databaseError]);
  assert.equal(databaseError.fallbackCode, 'F600');
});

test('student.update cleans up a newly uploaded attachment when the student is not found', async () => {
  const deleted = [];
  const controller = controllerFor({
    getActiveHobbyMask: async () => 0,
    getAttachmentById: async () => 'https://storage/old.png',
    uploadAttachment: async () => 'https://storage/new.png',
    update: async () => null,
    deleteAttachment: async (url) => { deleted.push(url); },
  });
  const res = makeRes();
  await controller.update(makeReq({
    params: { id: '4' },
    body: { fullname: 'New name' },
    file: { mimetype: 'image/jpeg', size: 3, originalname: 'new.jpg', buffer: Buffer.from('x') },
  }), res, makeNext());

  expectApiResponse(res, 404, 'F604', 'Kh\u00f4ng t\u00ecm th\u1ea5y sinh vi\u00ean', null);
  assert.deepEqual(deleted, ['https://storage/new.png']);
});

test('student.update deletes the old attachment after a successful database update', async () => {
  const deleted = [];
  const controller = controllerFor({
    getActiveHobbyMask: async () => 0,
    getAttachmentById: async () => 'https://storage/old.png',
    uploadAttachment: async () => 'https://storage/new.png',
    update: async () => ({ id: 4, attachment: 'https://storage/new.png' }),
    deleteAttachment: async (url) => { deleted.push(url); },
  });
  const res = makeRes();
  await controller.update(makeReq({
    params: { id: '4' },
    body: { fullname: 'New name' },
    file: { mimetype: 'image/jpeg', size: 3, originalname: 'new.jpg', buffer: Buffer.from('x') },
  }), res, makeNext());

  expectApiResponse(res, 200, '200', 'C\u1eadp nh\u1eadt sinh vi\u00ean th\u00e0nh c\u00f4ng', { id: 4, attachment: 'https://storage/new.png' });
  assert.deepEqual(deleted, ['https://storage/old.png']);
});

test('student.update preserves the new attachment when old attachment cleanup fails', async () => {
  const deleted = [];
  const updateCalls = [];
  const controller = controllerFor({
    getActiveHobbyMask: async () => 0,
    getAttachmentById: async () => 'https://storage/old.png',
    uploadAttachment: async () => 'https://storage/new.png',
    update: async (...args) => {
      updateCalls.push(args);
      return { id: 4, attachment: 'https://storage/new.png' };
    },
    deleteAttachment: async (url) => {
      deleted.push(url);
      throw new Error('old attachment cleanup failed');
    },
  });
  const res = makeRes();
  await controller.update(makeReq({
    params: { id: '4' },
    body: { fullname: 'New name' },
    file: { mimetype: 'image/jpeg', size: 3, originalname: 'new.jpg', buffer: Buffer.from('x') },
  }), res, makeNext());

  expectApiResponse(res, 200, '200', 'C\u1eadp nh\u1eadt sinh vi\u00ean th\u00e0nh c\u00f4ng', { id: 4, attachment: 'https://storage/new.png' });
  assert.deepEqual(updateCalls, [[4, { fullname: 'New name', attachment: 'https://storage/new.png' }]]);
  assert.deepEqual(deleted, ['https://storage/old.png']);
});

test('student.update does not call storage cleanup when no replacement attachment is provided', async () => {
  const deleted = [];
  const controller = controllerFor({
    getActiveHobbyMask: async () => 0,
    update: async () => ({ id: 4 }),
    deleteAttachment: async (url) => { deleted.push(url); },
  });
  const res = makeRes();
  await controller.update(makeReq({ params: { id: '4' }, body: { fullname: 'New name' } }), res, makeNext());

  expectApiResponse(res, 200, '200', 'C\u1eadp nh\u1eadt sinh vi\u00ean th\u00e0nh c\u00f4ng', { id: 4 });
  assert.deepEqual(deleted, []);
});

test('student.destroy returns deleted data and massDestroy preserves partial success', async () => {
  const destroyCalls = [];
  const one = controllerFor({ destroy: async (...args) => { destroyCalls.push(args); return { id: 4 }; } });
  const oneRes = makeRes();
  await one.destroy(makeReq({ params: { id: '4' } }), oneRes, makeNext());
  expectApiResponse(oneRes, 200, '200', 'Xóa sinh viên thành công', { id: 4 });
  assert.deepEqual(destroyCalls, [[4]]);

  const massCalls = [];
  const many = controllerFor({ massDestroy: async (...args) => { massCalls.push(args); return { deleted: [4], notFound: [8] }; } });
  const manyRes = makeRes();
  await many.massDestroy(makeReq({ body: { idlist: [4, 8] } }), manyRes, makeNext());
  expectApiResponse(manyRes, 200, '200', 'Đã xóa 1 sinh viên. Không tìm thấy ids: 8', { deleted: [4], notFound: [8] });
  assert.deepEqual(massCalls, [[[4, 8]]]);
});

test('student.copyOne and massCopy expose their current copy contracts', async () => {
  const oneCalls = [];
  const one = controllerFor({ copyOne: async (...args) => { oneCalls.push(args); return { id: 12 }; } });
  const oneRes = makeRes();
  await one.copyOne(makeReq({ params: { id: '4' } }), oneRes, makeNext());
  expectApiResponse(oneRes, 200, '200', 'Sao chép sinh viên thành công', { id: 12 });
  assert.deepEqual(oneCalls, [[4]]);

  const massCalls = [];
  const many = controllerFor({ massCopy: async (...args) => { massCalls.push(args); return { created: [{ id: 12 }], notFound: [8] }; } });
  const manyRes = makeRes();
  await many.massCopy(makeReq({ body: { idlist: [4, 8] } }), manyRes, makeNext());
  expectApiResponse(manyRes, 200, '200', 'Đã sao chép 1 sinh viên. Không tìm thấy ids: 8', [{ id: 12 }]);
  assert.deepEqual(massCalls, [[[4, 8]]]);
});

test('student.importStudents reports a missing multipart file without parsing a file', async () => {
  let parsed = false;
  const controller = controllerFor({}, {
    parseFile: async () => { parsed = true; return []; },
    buildFile: () => { throw new Error('not used'); },
  });
  const res = makeRes();
  await controller.importStudents(makeReq(), res, makeNext());
  expectApiResponse(res, 400, 'J604', 'Missing import file', null);
  assert.equal(parsed, false);
});

test('student.importStudents creates a preview and never writes students', async () => {
  let writes = 0;
  const controller = controllerFor({
    validateImportDrafts: async drafts => ({ rows: drafts.map(draft => ({ ...draft, mode: 'create', status: 'valid', errors: {}, missingHobbies: [] })) }),
    store: async () => { writes += 1; },
  }, {
    parseFile: async () => [{ ...validStudent, gender: 'Nam', hobbies: '' }],
    buildFile: () => { throw new Error('not used'); },
  });
  const res = makeRes();
  await controller.importStudents(makeReq({ file: { originalname: 'students.csv', buffer: Buffer.from('not-read') } }), res, makeNext());
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.rows.length, 1);
  assert.equal(writes, 0);
});

test('student.exportOne uses the requested format contract without a real file', async () => {
  const serviceCalls = [];
  const buildCalls = [];
  const output = Buffer.from('[]');
  const controller = controllerFor({
    getOneById: async (...args) => { serviceCalls.push(args); return { id: 4, fullname: 'A' }; },
    getFileLookups: async () => ({ classes: [], hobbies: [] }),
  }, {
    parseFile: async () => [],
    buildFile: (...args) => { buildCalls.push(args); return { buffer: output, contentType: 'application/json', extension: 'json' }; },
  });
  const res = makeRes();
  await controller.exportOne(makeReq({ params: { id: '4' }, query: { type: 'json' } }), res, makeNext());
  assert.deepEqual(serviceCalls, [[4]]);
  assert.equal(buildCalls[0][1], 'json');
  assert.equal(buildCalls[0][2].includes('password'), true);
  assert.equal(res.headers['Content-Type'], 'application/json');
  assert.equal(res.headers['Content-Disposition'], 'attachment; filename="student-4.json"');
  assert.equal(res.sent, output);
});

test('student.massExport forwards idlist and writes the export response headers', async () => {
  const serviceCalls = [];
  const output = Buffer.from('id,fullname');
  const controller = controllerFor({
    getManyByIds: async (...args) => { serviceCalls.push(args); return [{ id: 4 }]; },
    getFileLookups: async () => ({ classes: [], hobbies: [] }),
  }, {
    parseFile: async () => [],
    buildFile: () => ({ buffer: output, contentType: 'text/csv', extension: 'csv' }),
  });
  const res = makeRes();
  await controller.massExport(makeReq({ body: { idlist: [4, 8], type: 'csv' } }), res, makeNext());
  assert.deepEqual(serviceCalls, [[[4, 8]]]);
  assert.equal(res.headers['Content-Type'], 'text/csv');
  assert.equal(res.headers['Content-Disposition'], 'attachment; filename="students-export.csv"');
  assert.equal(res.sent, output);
});

test('student.copyValidate submits all drafts to one batch validation service call', async () => {
  const calls = [];
  const drafts = [{ draftKey: 'student-1', sourceId: 1, values: { code: 'SV01-copy' } }, { draftKey: 'student-2', sourceId: 2, values: { code: 'SV01-copy' } }];
  const controller = controllerFor({ validateCopyDrafts: async (...args) => { calls.push(args); return { rows: [{ draftKey: 'student-1', status: 'invalid', errors: { code: 'duplicate' } }] }; } });
  const res = makeRes();
  await controller.copyValidate(makeReq({ body: { drafts } }), res, makeNext());
  expectApiResponse(res, 200, '200', 'ÄÃ£ kiá»ƒm tra cÃ¡c báº£n sao sinh viÃªn', { rows: [{ draftKey: 'student-1', status: 'invalid', errors: { code: 'duplicate' } }] });
  assert.deepEqual(calls, [[drafts]]);
});

test('student copy preview is read-only and commit forwards validated drafts', async () => {
  const previewCalls = [];
  const commitCalls = [];
  const controller = controllerFor({
    getCopyPreview: async (...args) => { previewCalls.push(args); return { drafts: [{ draftKey: 'student-4' }], notFoundIds: [] }; },
    getActiveHobbyMask: async () => 0,
    commitCopyDrafts: async (...args) => { commitCalls.push(args); return { created: [{ draftKey: 'student-4', record: { id: 9 } }] }; },
  });
  const previewRes = makeRes();
  await controller.copyPreview(makeReq({ body: { idlist: [4] } }), previewRes, makeNext());
  assert.deepEqual(previewCalls, [[[4]]]);
  assert.equal(previewRes.body.data.drafts[0].draftKey, 'student-4');

  const draft = { draftKey: 'student-4', sourceId: 4, values: { ...validStudent, hobbies: 0 } };
  const commitRes = makeRes();
  await controller.copyCommit(makeReq({ body: { drafts: [draft] } }), commitRes, makeNext());
  assert.equal(commitCalls.length, 1);
  assert.equal(commitCalls[0][0][0].values.password, undefined);
  assert.equal(commitRes.body.data.created[0].record.id, 9);
});
