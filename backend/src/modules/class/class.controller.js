const classService = require('./class.service');
const { successResponse, errorResponse } = require('../../utils/response');
const { parseFile, buildFile } = require('../../utils/fileFormat');
const asyncHandler = require('../../core/http/asyncHandler');
const {
  createGetAllHandler,
  createGetByIdHandler,
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

const getById = createGetByIdHandler({
  service: (...args) => classService.getOneById(...args),
  requestParser: (req) => [validator.parseGetById(req.params.id)],
  successMessage: 'L\u1ea5y chi ti\u1ebft l\u1edbp th\u00e0nh c\u00f4ng',
  fallbackCode: 'D600',
  notFound: errors.getById.notFound,
});

const getStudents = createGetByPageHandler({
  service: (...args) => classService.getStudentsByClass(...args),
  requestParser: (req) => [
    validator.parseClassStudentsId(req.params.id),
    validator.parseClassStudentsPageQuery(req.query),
  ],
  successMessage: 'L\u1ea5y danh s\u00e1ch sinh vi\u00ean trong l\u1edbp th\u00e0nh c\u00f4ng',
  fallbackCode: 'L600',
  notFound: errors.students.classNotFound,
});

const getAvailableStudents = createGetByPageHandler({
  service: (...args) => classService.getAvailableStudentsByClass(...args),
  requestParser: (req) => [
    validator.parseClassStudentsId(req.params.id),
    validator.parseClassStudentsPageQuery(req.query),
  ],
  successMessage: 'Lấy danh sách sinh viên có thể thêm vào lớp thành công',
  fallbackCode: 'L600',
  notFound: errors.students.classNotFound,
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
        { deletedIds, blockedIds },
        `Đã xóa ${deletedIds.length} lớp. Không thể xóa ${blockedIds.length} lớp vì còn sinh viên liên kết (ids: ${blockedIds.join(', ')})`
      );
    }
    return successResponse(res, { deletedIds, blockedIds }, 'Xóa các lớp thành công');
  } catch (error) {
    if (sendExpectedError(res, error)) return undefined;
    error.fallbackCode = 'I600';
    throw error;
  }
});

// POST /class/copy/:id
const assignStudents = asyncHandler(async (req, res) => {
  try {
    const classId = validator.parseClassStudentsId(req.params.id);
    const studentIds = validator.parseStudentIds(req.body.studentIds);
    const assignedIds = await classService.assignStudents(classId, studentIds);
    return successResponse(res, { studentIds: assignedIds }, 'Thêm sinh viên vào lớp thành công');
  } catch (error) {
    if (sendExpectedError(res, error)) return undefined;
    error.fallbackCode = 'L600';
    throw error;
  }
});

const removeStudent = asyncHandler(async (req, res) => {
  try {
    const classId = validator.parseClassStudentsId(req.params.id);
    const studentId = validator.parseClassStudentId(req.params.studentId);
    const data = await classService.removeStudent(classId, studentId);
    return successResponse(res, data, 'Loại sinh viên khỏi lớp thành công');
  } catch (error) {
    if (sendExpectedError(res, error)) return undefined;
    error.fallbackCode = 'L600';
    throw error;
  }
});

const importClasses = asyncHandler(async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, errors.import.invalidFile.statusCode, errors.import.invalidFile.errorCode, 'Không tìm thấy file upload');
    const extension = req.file.originalname.split('.').pop().toLowerCase();
    let rows;
    try {
      rows = await parseFile(req.file.buffer, extension);
    } catch (error) {
      if (error.message === 'UNSUPPORTED_FORMAT') {
        return errorResponse(res, errors.import.unsupportedFormat.statusCode, errors.import.unsupportedFormat.errorCode, errors.import.unsupportedFormat.message);
      }
      return errorResponse(res, errors.import.invalidFile.statusCode, errors.import.invalidFile.errorCode, `Không đọc được dữ liệu từ file: ${error.message}`);
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return errorResponse(res, errors.import.invalidFile.statusCode, errors.import.invalidFile.errorCode, 'File không có dữ liệu');
    }

    const created = [];
    const failed = [];
    for (let index = 0; index < rows.length; index += 1) {
      const validation = validator.validateImportRow(rows[index] || {});
      if (validation.error) {
        failed.push({ row: index + 2, reason: validation.error });
        continue;
      }
      try {
        created.push(await classService.store(validation.value));
      } catch (error) {
        failed.push({
          row: index + 2,
          reason: error.code === '23505' ? errors.store.duplicate.message : (error.message || 'Lỗi không xác định'),
        });
      }
    }
    return successResponse(res, { created, failed }, `Import thành công ${created.length} dòng, lỗi ${failed.length} dòng`);
  } catch (error) {
    error.fallbackCode = 'J600';
    throw error;
  }
});

const exportOne = asyncHandler(async (req, res) => {
  try {
    const id = validator.parseExportId(req.params.id);
    const type = (req.query.type || 'xlsx').toLowerCase();
    if (!validator.isValidExportType(type)) {
      return errorResponse(res, errors.export.invalid.statusCode, errors.export.invalid.errorCode, errors.export.invalid.message);
    }
    const classRecord = await classService.getOneForExport(id);
    if (!classRecord) return errorResponse(res, errors.export.notFound.statusCode, errors.export.notFound.errorCode, errors.export.notFound.message);
    const { buffer, contentType, extension } = buildFile([classRecord], type);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="class-${id}.${extension}"`);
    return res.send(buffer);
  } catch (error) {
    error.fallbackCode = 'K600';
    throw error;
  }
});

const massExport = asyncHandler(async (req, res) => {
  try {
    const type = (req.body.type || 'xlsx').toLowerCase();
    const idlist = validator.parseExportIds(req.body.idlist);
    if (!validator.isValidExportType(type)) {
      return errorResponse(res, errors.export.invalid.statusCode, errors.export.invalid.errorCode, errors.export.invalid.message);
    }
    const rows = await classService.getManyForExport(idlist);
    const { buffer, contentType, extension } = buildFile(rows, type);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="classes-export.${extension}"`);
    return res.send(buffer);
  } catch (error) {
    error.fallbackCode = 'K600';
    throw error;
  }
});

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
  getById,
  getStudents,
  getAvailableStudents,
  store,
  update,
  destroy,
  massDelete,
  assignStudents,
  removeStudent,
  copyOne,
  massCopy,
  importClasses,
  exportOne,
  massExport,
};
