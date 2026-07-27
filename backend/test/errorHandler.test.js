const test = require('node:test');
const assert = require('node:assert/strict');
const AppError = require('../src/core/http/AppError');
const errorHandler = require('../src/middlewares/errorHandler');

const makeResponse = () => {
  const response = { writes: 0 };
  response.status = (statusCode) => {
    response.statusCode = statusCode;
    return response;
  };
  response.json = (body) => {
    response.writes += 1;
    response.body = body;
    return response;
  };
  return response;
};

test('errorHandler returns the existing envelope for AppError statusCode metadata', () => {
  const response = makeResponse();
  const error = new AppError({ statusCode: 422, errorCode: 'X603', message: 'Invalid data' });
  error.httpStatus = 409;
  errorHandler(error, {}, response, () => { throw new Error('next must not be called'); });

  assert.equal(response.writes, 1);
  assert.deepEqual(response.body, {
    code: 'X603', status: 422, message: 'Invalid data', data: null,
  });
});

test('errorHandler supports legacy httpStatus metadata', () => {
  const response = makeResponse();
  errorHandler({ httpStatus: 409, errorCode: 'E603', message: 'Conflict' }, {}, response, () => {});

  assert.equal(response.writes, 1);
  assert.deepEqual(response.body, {
    code: 'E603', status: 409, message: 'Conflict', data: null,
  });
});

test('errorHandler falls back to 500 and writes exactly one response for unknown errors', () => {
  const response = makeResponse();
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    errorHandler({ fallbackCode: 'F600' }, {}, response, () => {});
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.writes, 1);
  assert.deepEqual(response.body, {
    code: 'F600', status: 500, message: 'L\u1ed7i h\u1ec7 th\u1ed1ng kh\u00f4ng x\u00e1c \u0111\u1ecbnh', data: null,
  });
});
