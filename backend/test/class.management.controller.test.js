const test = require('node:test');
const assert = require('node:assert/strict');
const AppError = require('../src/core/http/AppError');
const { loadController, makeReq, makeRes, expectApiResponse, makeNext } = require('./controllerTestHelpers');

const controllerFor = (serviceMock, fileFormatMock) => loadController({
  controller: '../src/modules/class/class.controller.js',
  service: '../src/modules/class/class.service.js',
  serviceMock,
  dependencies: fileFormatMock ? { '../src/utils/fileFormat.js': fileFormatMock } : {},
});

test('class.getById returns the class detail including student_count', async () => {
  const calls = [];
  const controller = controllerFor({ getOneById: async (...args) => { calls.push(args); return { id: 7, student_count: '2' }; } });
  const res = makeRes();
  await controller.getById(makeReq({ params: { id: '7' } }), res, makeNext());
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.code, '200');
  assert.deepEqual(res.body.data, { id: 7, student_count: '2' });
  assert.ok(res.body.message);
  assert.deepEqual(calls, [[7]]);
});

test('class.getStudents parses paging and reports a missing class', async () => {
  const calls = [];
  const controller = controllerFor({ getStudentsByClass: async (...args) => { calls.push(args); return { page_info: { current: 1 }, records: [] }; } });
  const res = makeRes();
  await controller.getStudents(makeReq({
    params: { id: '7' },
    query: { page: '1', size: '5', search: 'An', order: 'fn:1', columnlist: 'id,fullname' },
  }), res, makeNext());
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.code, '200');
  assert.deepEqual(res.body.data, { page_info: { current: 1 }, records: [] });
  assert.ok(res.body.message);
  assert.deepEqual(calls, [[7, {
    page: 1, size: 5, search: 'An', order: 'fn:1', columnlist: 'id,fullname', toplist: [],
  }]]);

  const missing = controllerFor({ getStudentsByClass: async () => null });
  const missingRes = makeRes();
  await missing.getStudents(makeReq({ params: { id: '7' }, query: { page: '1', size: '5' } }), missingRes, makeNext());
  assert.equal(missingRes.statusCode, 404);
  assert.equal(missingRes.body.code, 'L604');
  assert.equal(missingRes.body.data, null);
  assert.ok(missingRes.body.message);
});

test('class.assignStudents de-duplicates ids and preserves expected service errors', async () => {
  const calls = [];
  const controller = controllerFor({ assignStudents: async (...args) => { calls.push(args); return args[1]; } });
  const res = makeRes();
  await controller.assignStudents(makeReq({ params: { id: '7' }, body: { studentIds: [1, 2, 1] } }), res, makeNext());
  expectApiResponse(res, 200, '200', 'Th\u00eam sinh vi\u00ean v\u00e0o l\u1edbp th\u00e0nh c\u00f4ng', { studentIds: [1, 2] });
  assert.deepEqual(calls, [[7, [1, 2]]]);

  const rejected = controllerFor({
    assignStudents: async () => { throw new AppError({ statusCode: 409, errorCode: 'L607', message: 'Already assigned' }); },
  });
  const rejectedRes = makeRes();
  await rejected.assignStudents(makeReq({ params: { id: '7' }, body: { studentIds: [1] } }), rejectedRes, makeNext());
  expectApiResponse(rejectedRes, 409, 'L607', 'Already assigned', null);
});

test('class.removeStudent returns only the removed student id', async () => {
  const calls = [];
  const controller = controllerFor({ removeStudent: async (...args) => { calls.push(args); return { studentId: 3 }; } });
  const res = makeRes();
  await controller.removeStudent(makeReq({ params: { id: '7', studentId: '3' } }), res, makeNext());
  expectApiResponse(res, 200, '200', 'Lo\u1ea1i sinh vi\u00ean kh\u1ecfi l\u1edbp th\u00e0nh c\u00f4ng', { studentId: 3 });
  assert.deepEqual(calls, [[7, 3]]);
});

test('class.import supports every configured file extension and returns partial results', async () => {
  for (const extension of ['csv', 'xlsx', 'json', 'xml']) {
    const parseCalls = [];
    const controller = controllerFor({ store: async () => ({ id: 9 }) }, {
      parseFile: async (...args) => { parseCalls.push(args); return [{ code: ' C01 ', name: ' Class 1 ', description: 'x' }]; },
      buildFile: () => { throw new Error('not used'); },
    });
    const res = makeRes();
    await controller.importClasses(makeReq({ file: { originalname: `classes.${extension}`, buffer: Buffer.from('rows') } }), res, makeNext());
    expectApiResponse(res, 200, '200', 'Import th\u00e0nh c\u00f4ng 1 d\u00f2ng, l\u1ed7i 0 d\u00f2ng', { created: [{ id: 9 }], failed: [] });
    assert.deepEqual(parseCalls, [[Buffer.from('rows'), extension]]);
  }
});

test('class export one and many support csv, xlsx, json, and xml', async () => {
  for (const type of ['csv', 'xlsx', 'json', 'xml']) {
    const output = Buffer.from(type);
    const buildCalls = [];
    const exportCalls = [];
    const controller = controllerFor({
      getOneForExport: async () => ({ code: 'C01', name: 'Class 1', description: null }),
      getManyForExport: async (...args) => { exportCalls.push(args); return [{ code: 'C01', name: 'Class 1', description: null }]; },
    }, {
      parseFile: async () => [],
      buildFile: (...args) => { buildCalls.push(args); return { buffer: output, contentType: `application/${type}`, extension: type }; },
    });
    const oneRes = makeRes();
    await controller.exportOne(makeReq({ params: { id: '7' }, query: { type } }), oneRes, makeNext());
    assert.equal(oneRes.sent, output);
    assert.equal(oneRes.headers['Content-Disposition'], `attachment; filename="class-7.${type}"`);

    const manyRes = makeRes();
    await controller.massExport(makeReq({ body: { idlist: [7], type } }), manyRes, makeNext());
    assert.equal(manyRes.sent, output);
    assert.equal(manyRes.headers['Content-Disposition'], `attachment; filename="classes-export.${type}"`);
    assert.equal(buildCalls.length, 2);
    assert.deepEqual(exportCalls, [[[7]]]);
  }
});
