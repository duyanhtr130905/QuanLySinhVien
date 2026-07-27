const classService = require('./class.service');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../core/http/asyncHandler');
const {
  createGetAllHandler,
  createGetByPageHandler,
  createCopyOneHandler,
  createMassCopyHandler,
} = require('../../core/http/controllerHandlers');
const validator = require('./class.validator');
const errors = require('./class.errors');

const sendExpectedError = (res, error) => {
  if (!error.statusCode || !error.errorCode) return false;
  errorResponse(res, error.statusCode, error.errorCode, error.message);
  return true;
};

// GET /class
const getAll = createGetAllHandler({
  service: (...args) => classService.getAll(...args),
  requestParser: (req) => [req.query.columnlist],
  successMessage: 'Lấy danh sách lớp thành công',
  fallbackCode: 'B600',
});

// GET /class/page/:init?
const getByPage = createGetByPageHandler({
  service: (...args) => classService.getByPage(...args),
  requestParser: (req) => [validator.parseGetByPage(req.query)],
  successMessage: 'Lấy danh sách lớp theo trang thành công',
  fallbackCode: 'C600',
});

// POST /class
const store = asyncHandler(async (req, res) => {
  try {
    const data = await classService.store(validator.validateStore(req.body));
    return successResponse(res, data, 'Tạo lớp thành công');
  } catch (error) {
    if (sendExpectedError(res, error)) return undefined;
    if (error.code === '23505') {
      return errorResponse(res, errors.store.duplicate.statusCode, errors.store.duplicate.errorCode, errors.store.duplicate.message);
    }
    error.fallbackCode = 'E600';
    throw error;
  }
});

// PUT /class/:id
const update = asyncHandler(async (req, res) => {
  try {
    const id = validator.parseUpdateId(req.params.id);
    const data = await classService.update(id, validator.validateUpdate(req.body));
    if (!data) return errorResponse(res, errors.update.notFound.statusCode, errors.update.notFound.errorCode, errors.update.notFound.message);
    return successResponse(res, data, 'Cập nhật lớp thành công');
  } catch (error) {
    if (sendExpectedError(res, error)) return undefined;
    if (error.code === '23505') {
      return errorResponse(res, errors.update.duplicate.statusCode, errors.update.duplicate.errorCode, errors.update.duplicate.message);
    }
    error.fallbackCode = 'F600';
    throw error;
  }
});

// DELETE /class/:id
const destroy = asyncHandler(async (req, res) => {
  try {
    const id = validator.parseDestroyId(req.params.id);
    const exists = await classService.existsById(id);
    if (!exists) return errorResponse(res, errors.destroy.notFound.statusCode, errors.destroy.notFound.errorCode, errors.destroy.notFound.message);
    const data = await classService.destroy(id);
    return successResponse(res, data, 'Xóa lớp thành công');
  } catch (error) {
    if (sendExpectedError(res, error)) return undefined;
    if (error.code === '23503') {
      return errorResponse(
        res,
        errors.destroy.foreignKeyBlocked.statusCode,
        errors.destroy.foreignKeyBlocked.errorCode,
        errors.destroy.foreignKeyBlocked.message
      );
    }
    error.fallbackCode = 'G600';
    throw error;
  }
});

// DELETE /class/delete
const massDelete = asyncHandler(async (req, res) => {
  try {
    const { deletedIds, blockedIds } = await classService.massDelete(validator.parseMassDeleteIds(req.body.ids));
    if (blockedIds.length > 0) {
      return successResponse(
        res,
        { ids: deletedIds },
        `Đã xóa ${deletedIds.length} lớp. Không thể xóa ${blockedIds.length} lớp vì còn sinh viên liên kết (ids: ${blockedIds.join(', ')})`
      );
    }
    return successResponse(res, { ids: deletedIds }, 'Xóa các lớp thành công');
  } catch (error) {
    if (sendExpectedError(res, error)) return undefined;
    error.fallbackCode = 'I600';
    throw error;
  }
});

// POST /class/copy/:id
const copyOne = createCopyOneHandler({
  service: (...args) => classService.copyOne(...args),
  requestParser: (req) => [validator.parseCopyOneId(req.params.id)],
  successMessage: 'Sao chép lớp thành công',
  fallbackCode: 'H600',
  notFound: errors.copyOne.notFound,
});

// POST /class/copy
const massCopy = createMassCopyHandler({
  service: (...args) => classService.massCopy(...args),
  requestParser: (req) => [validator.parseMassCopyIdList(req.body.idlist)],
  successMessage: ({ created, notFound }) => (notFound.length > 0
    ? `Đã sao chép ${created.length} lớp. Không tìm thấy ids: ${notFound.join(', ')}`
    : `Sao chép ${created.length} lớp thành công`),
  responseMapper: ({ created }) => created,
  fallbackCode: 'H600',
  notFound: {
    ...errors.massCopy.notFound,
    when: ({ created, notFound }) => notFound.length > 0 && created.length === 0,
    message: ({ notFound }) => `${errors.massCopy.notFound.message} (ids: ${notFound.join(', ')})`,
  },
});

module.exports = {
  getAll,
  getByPage,
  store,
  update,
  destroy,
  massDelete,
  copyOne,
  massCopy,
};
