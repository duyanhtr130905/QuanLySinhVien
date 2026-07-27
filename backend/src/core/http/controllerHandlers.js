const asyncHandler = require('./asyncHandler');
const { successResponse, errorResponse } = require('../../utils/response');

const resolveValue = (value, data, req) => (typeof value === 'function' ? value(data, req) : value);

const createHandler = ({
  service,
  requestParser = () => [],
  successMessage = 'Thành công',
  fallbackCode,
  notFound,
  responseMapper = (data) => data,
}) => {
  if (typeof service !== 'function') throw new TypeError('service phải là function');
  if (typeof requestParser !== 'function') throw new TypeError('requestParser phải là function');
  if (typeof responseMapper !== 'function') throw new TypeError('responseMapper phải là function');

  return asyncHandler(async (req, res) => {
    try {
      const serviceArgs = requestParser(req);
      if (!Array.isArray(serviceArgs)) {
        throw new TypeError('requestParser phải trả về một mảng service arguments');
      }

      const data = await service(...serviceArgs);
      const isNotFound = notFound && (notFound.when || ((value) => value == null))(data, req);
      if (isNotFound) {
        return errorResponse(
          res,
          resolveValue(notFound.statusCode, data, req),
          resolveValue(notFound.errorCode, data, req),
          resolveValue(notFound.message, data, req)
        );
      }

      return successResponse(res, responseMapper(data, req), resolveValue(successMessage, data, req));
    } catch (error) {
      if (error.statusCode && error.errorCode) {
        return errorResponse(res, error.statusCode, error.errorCode, error.message);
      }
      if (fallbackCode) error.fallbackCode = fallbackCode;
      throw error;
    }
  });
};

const createGetAllHandler = (config) => createHandler(config);
const createGetByIdHandler = (config) => createHandler(config);
const createGetByPageHandler = (config) => createHandler(config);
const createCopyOneHandler = (config) => createHandler(config);
const createMassCopyHandler = (config) => createHandler(config);

module.exports = {
  createGetAllHandler,
  createGetByIdHandler,
  createGetByPageHandler,
  createCopyOneHandler,
  createMassCopyHandler,
};
