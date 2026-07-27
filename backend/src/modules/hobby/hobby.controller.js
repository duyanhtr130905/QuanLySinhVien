const hobbyService = require('./hobby.service');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../core/http/asyncHandler');
const { createGetAllHandler } = require('../../core/http/controllerHandlers');
const validator = require('./hobby.validator');
const errors = require('./hobby.errors');

const sendExpectedError = (res, error) => {
  if (!error.statusCode || !error.errorCode) return false;
  errorResponse(res, error.statusCode, error.errorCode, error.message);
  return true;
};

// GET /hobby
const getAll = createGetAllHandler({
  service: (...args) => hobbyService.getAll(...args),
  requestParser: () => [],
  successMessage: 'Lấy danh sách sở thích thành công',
  fallbackCode: 'B600',
});

// POST /hobby
const store = asyncHandler(async (req, res) => {
  try {
    const data = await hobbyService.store(validator.validateStore(req.body));
    return successResponse(res, data, 'Tạo sở thích thành công');
  } catch (error) {
    if (sendExpectedError(res, error)) return undefined;
    if (error.isBitExhausted) {
      return errorResponse(res, errors.store.bitExhausted.statusCode, errors.store.bitExhausted.errorCode, error.message);
    }
    if (error.code === '23505') {
      return errorResponse(
        res,
        errors.store.duplicate.statusCode,
        errors.store.duplicate.errorCode,
        errors.uniqueMessageForConstraint(error.constraint)
      );
    }
    error.fallbackCode = 'E600';
    throw error;
  }
});

// DELETE /hobby/:id
const destroy = asyncHandler(async (req, res) => {
  try {
    const id = validator.parseDestroyId(req.params.id);
    const hobby = await hobbyService.findById(id);
    if (!hobby) return errorResponse(res, errors.destroy.notFound.statusCode, errors.destroy.notFound.errorCode, errors.destroy.notFound.message);

    const inUse = await hobbyService.isUsedByStudent(hobby.bit_value);
    if (inUse) return errorResponse(res, errors.destroy.inUse.statusCode, errors.destroy.inUse.errorCode, errors.destroy.inUse.message);

    const data = await hobbyService.destroy(id);
    return successResponse(res, data, 'Xóa sở thích thành công');
  } catch (error) {
    if (sendExpectedError(res, error)) return undefined;
    error.fallbackCode = 'G600';
    throw error;
  }
});

module.exports = { getAll, store, destroy };
