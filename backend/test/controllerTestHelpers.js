const assert = require('node:assert/strict');
const path = require('node:path');

const loadController = ({ controller, service, serviceMock, dependencies = {} }) => {
  const controllerPath = require.resolve(path.resolve(__dirname, controller));
  const mockedModules = {
    [require.resolve(path.resolve(__dirname, service))]: serviceMock,
  };

  for (const [modulePath, moduleExports] of Object.entries(dependencies)) {
    mockedModules[require.resolve(path.resolve(__dirname, modulePath))] = moduleExports;
  }

  const previous = new Map();
  for (const [modulePath, moduleExports] of Object.entries(mockedModules)) {
    previous.set(modulePath, require.cache[modulePath]);
    require.cache[modulePath] = {
      id: modulePath,
      filename: modulePath,
      loaded: true,
      exports: moduleExports,
    };
  }

  delete require.cache[controllerPath];
  const loaded = require(controllerPath);
  delete require.cache[controllerPath];

  for (const modulePath of Object.keys(mockedModules)) {
    const original = previous.get(modulePath);
    if (original) require.cache[modulePath] = original;
    else delete require.cache[modulePath];
  }

  return loaded;
};

const makeReq = ({ query = {}, params = {}, body = {}, file } = {}) => ({
  query,
  params,
  body,
  ...(file === undefined ? {} : { file }),
});

const makeRes = () => ({
  statusCode: undefined,
  body: undefined,
  headers: {},
  sent: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  setHeader(name, value) {
    this.headers[name] = value;
  },
  send(value) {
    this.sent = value;
    return this;
  },
});

const expectApiResponse = (res, status, code, message, data) => {
  assert.equal(res.statusCode, status);
  assert.deepEqual(res.body, { code, status, message, data });
};

const makeNext = () => {
  const calls = [];
  const next = (err) => calls.push(err);
  next.calls = calls;
  return next;
};

module.exports = { loadController, makeReq, makeRes, expectApiResponse, makeNext };
