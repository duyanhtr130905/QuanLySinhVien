const studentService = require('./student.service');
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
const validator = require('./student.validator');
const errors = require('./student.errors');
const { normalizeMultipartBody } = require('./student.multipart');
const fileService = require('./student.fileService');

const storage = {
  uploadAttachment: (...args) => studentService.uploadAttachment(...args),
  deleteAttachment: (...args) => studentService.deleteAttachment(...args),
  getAttachmentById: (...args) => studentService.getAttachmentById(...args),
};

const sendError = (res, errorConfig, message = errorConfig.message) =>
  errorResponse(res, errorConfig.statusCode, errorConfig.errorCode, message);

const sendExpectedError = (res, error) => {
  if (!error.statusCode || !error.errorCode) return false;
  sendError(res, error);
  return true;
};

// GET /student
const getAll = createGetAllHandler({
  service: (...args) => studentService.getAll(...args),
  requestParser: (req) => [req.query.columnlist],
  successMessage: 'Lấy danh sách sinh viên thành công',
  fallbackCode: 'B600',
});

// GET /student/page/:init?
const getByPage = createGetByPageHandler({
  service: (...args) => studentService.getByPage(...args),
  requestParser: (req) => [validator.parseGetByPage(req.query)],
  successMessage: 'Lấy danh sách sinh viên theo trang thành công',
  fallbackCode: 'C600',
});

const getDeletedByPage = createGetByPageHandler({
  service: (...args) => studentService.getDeletedByPage(...args),
  requestParser: (req) => [validator.parseGetByPage(req.query)],
  successMessage: 'L\u1ea5y danh s\u00e1ch sinh vi\u00ean \u0111\u00e3 x\u00f3a th\u00e0nh c\u00f4ng',
  fallbackCode: 'L600',
});

// GET /student/:id
const getById = createGetByIdHandler({
  service: (...args) => studentService.getOneById(...args),
  requestParser: (req) => [validator.parseGetById(req.params.id)],
  successMessage: 'Lấy chi tiết sinh viên thành công',
  fallbackCode: 'D600',
  notFound: errors.getById.notFound,
});

// POST /student
const store = asyncHandler(async (req, res) => {
  let attachmentUrl = null;
  try {
    const body = normalizeMultipartBody(req.body);
    const activeMask = await studentService.getActiveHobbyMask();
    const validationMessage = validator.validateStudent(body, true, activeMask);
    if (validationMessage) return sendError(res, errors.store.validation, validationMessage);

    attachmentUrl = await fileService.prepareCreateAttachment(req.file, body.code, storage);
    const data = await studentService.store({ ...body, attachment: attachmentUrl });
    return successResponse(res, data, 'Tạo sinh viên thành công');
  } catch (error) {
    await fileService.cleanupNewAttachment(attachmentUrl, storage);
    if (error.code === '23505') return sendError(res, errors.store.duplicate, errors.uniqueMessageForConstraint(error.constraint));
    if (error.code === '23503') return sendError(res, errors.store.classNotFound);
    error.fallbackCode = 'E600';
    throw error;
  }
});

// PUT /student/:id
const update = asyncHandler(async (req, res) => {
  let attachment = { newAttachmentUrl: undefined, oldAttachmentUrl: null };
  let databaseUpdated = false;
  try {
    const id = validator.parseUpdateId(req.params.id);
    const body = normalizeMultipartBody(req.body);
    const activeMask = await studentService.getActiveHobbyMask();
    const validationMessage = validator.validateStudent(body, false, activeMask);
    if (validationMessage) return sendError(res, errors.update.validation, validationMessage);

    attachment = await fileService.prepareUpdateAttachment(req.file, id, storage);
    const updateBody = attachment.newAttachmentUrl !== undefined
      ? { ...body, attachment: attachment.newAttachmentUrl }
      : body;
    const data = await studentService.update(id, updateBody);

    if (!data) {
      await fileService.cleanupNewAttachment(attachment.newAttachmentUrl, storage, { suppressErrors: false });
      return sendError(res, errors.update.notFound);
    }

    databaseUpdated = true;
    await fileService.cleanupOldAttachmentAfterUpdate(attachment, storage);
    return successResponse(res, data, 'Cập nhật sinh viên thành công');
  } catch (error) {
    if (!databaseUpdated) await fileService.cleanupNewAttachment(attachment.newAttachmentUrl, storage);
    if (sendExpectedError(res, error)) return undefined;
    if (error.code === '23505') return sendError(res, errors.update.duplicate, errors.uniqueMessageForConstraint(error.constraint));
    if (error.code === '23503') return sendError(res, errors.update.classNotFound);
    error.fallbackCode = 'F600';
    throw error;
  }
});

// DELETE /student/:id
const destroy = asyncHandler(async (req, res) => {
  try {
    const data = await studentService.destroy(validator.parseDestroyId(req.params.id));
    if (!data) return sendError(res, errors.destroy.notFound);
    return successResponse(res, data, 'Xóa sinh viên thành công');
  } catch (error) {
    if (sendExpectedError(res, error)) return undefined;
    error.fallbackCode = 'G600';
    throw error;
  }
});

// DELETE /student
const massDestroy = asyncHandler(async (req, res) => {
  try {
    const { deleted, notFound } = await studentService.massDestroy(validator.parseMassDestroyIdList(req.body.idlist));
    if (notFound.length > 0 && deleted.length === 0) {
      return sendError(res, errors.destroy.massNotFound, `${errors.destroy.massNotFound.message} (ids: ${notFound.join(', ')})`);
    }
    return successResponse(
      res,
      { deleted, notFound },
      notFound.length > 0
        ? `Đã xóa ${deleted.length} sinh viên. Không tìm thấy ids: ${notFound.join(', ')}`
        : `Xóa ${deleted.length} sinh viên thành công`
    );
  } catch (error) {
    if (sendExpectedError(res, error)) return undefined;
    error.fallbackCode = 'G600';
    throw error;
  }
});

const restoreDeleted = asyncHandler(async (req, res) => {
  try {
    const result = await studentService.restoreDeleted(validator.parseTrashIdList(req.body.idlist));
    return successResponse(
      res,
      result,
      `\u0110\u00e3 kh\u00f4i ph\u1ee5c ${result.restored.length} sinh vi\u00ean`
    );
  } catch (error) {
    if (sendExpectedError(res, error)) return undefined;
    error.fallbackCode = 'L600';
    throw error;
  }
});

const permanentlyDelete = asyncHandler(async (req, res) => {
  try {
    const result = await studentService.permanentlyDelete(validator.parseTrashIdList(req.body.idlist));
    // Storage cleanup is deliberately after commit: a failed remote cleanup never rolls back DB deletion.
    for (const attachmentUrl of result.attachmentsToDelete) {
      try {
        await studentService.deleteAttachment(attachmentUrl);
      } catch (error) {
        console.error('Could not remove permanently deleted student attachment:', error.message);
      }
    }

    return successResponse(
      res,
      { deleted: result.deleted, notFound: result.notFound },
      `\u0110\u00e3 x\u00f3a v\u0129nh vi\u1ec5n ${result.deleted.length} sinh vi\u00ean`
    );
  } catch (error) {
    if (sendExpectedError(res, error)) return undefined;
    error.fallbackCode = 'L600';
    throw error;
  }
});

// POST /student/copy/:id
const copyOne = createCopyOneHandler({
  service: (...args) => studentService.copyOne(...args),
  requestParser: (req) => [validator.parseCopyOneId(req.params.id)],
  successMessage: 'Sao chép sinh viên thành công',
  fallbackCode: 'H600',
  notFound: errors.copy.notFound,
});

// POST /student/copy
const massCopy = createMassCopyHandler({
  service: (...args) => studentService.massCopy(...args),
  requestParser: (req) => [validator.parseMassCopyIdList(req.body.idlist)],
  successMessage: ({ created, notFound }) => (notFound.length > 0
    ? `Đã sao chép ${created.length} sinh viên. Không tìm thấy ids: ${notFound.join(', ')}`
    : `Sao chép ${created.length} sinh viên thành công`),
  responseMapper: ({ created }) => created,
  fallbackCode: 'H600',
  notFound: {
    ...errors.copy.massNotFound,
    when: ({ created, notFound }) => notFound.length > 0 && created.length === 0,
    message: ({ notFound }) => `${errors.copy.massNotFound.message} (ids: ${notFound.join(', ')})`,
  },
});

// Preview is intentionally read-only. The browser receives no password or internal fields.
const copyPreview = asyncHandler(async (req, res) => {
  try {
    const data = await studentService.getCopyPreview(validator.parseMassCopyIdList(req.body.idlist));
    return successResponse(res, data, `Đã tạo ${data.drafts.length} draft sinh viên`);
  } catch (error) {
    if (sendExpectedError(res, error)) return undefined;
    error.fallbackCode = 'H600';
    throw error;
  }
});

const copyCommit = asyncHandler(async (req, res) => {
  const uploadedUrls = [];
  try {
    const activeMask = await studentService.getActiveHobbyMask();
    const rawDrafts = typeof req.body.drafts === 'string' ? JSON.parse(req.body.drafts) : req.body.drafts;
    const drafts = validator.parseCopyDrafts(rawDrafts, activeMask);
    const attachmentUrls = new Map();
    for (const file of req.files || []) {
      const draftKey = file.fieldname.replace(/^attachment-/, '');
      const draft = drafts.find(item => item.draftKey === draftKey);
      if (!draft || attachmentUrls.has(draftKey)) {
        const invalidAttachment = new Error('Ảnh draft không hợp lệ');
        invalidAttachment.statusCode = 400;
        invalidAttachment.errorCode = errors.copy.invalidIdList.errorCode;
        throw invalidAttachment;
      }
      const url = await fileService.prepareCreateAttachment(file, draft.values.code, storage);
      attachmentUrls.set(draftKey, url);
      uploadedUrls.push(url);
    }
    const data = await studentService.commitCopyDrafts(drafts, attachmentUrls);
    return successResponse(res, data, `Đã tạo ${data.created.length} sinh viên`);
  } catch (error) {
    await Promise.all(uploadedUrls.map(url => fileService.cleanupNewAttachment(url, storage)));
    if (sendExpectedError(res, error)) return undefined;
    if (error.code === 'COPY_DUPLICATE') return sendError(res, errors.copy.invalidIdList, error.message);
    if (error.code === 'COPY_SOURCE_NOT_FOUND') return sendError(res, errors.copy.notFound, error.message);
    if (error.code === '23505') return sendError(res, errors.copy.invalidIdList, errors.uniqueMessageForConstraint(error.constraint));
    if (error.code === '23503') return sendError(res, errors.copy.invalidIdList, 'class_id không tồn tại');
    error.fallbackCode = 'H600';
    throw error;
  }
});

// POST /student/import
const importStudents = asyncHandler(async (req, res) => {
  try {
    if (!req.file) return sendError(res, errors.import.invalidFile, 'Không tìm thấy file upload');

    const extension = req.file.originalname.split('.').pop().toLowerCase();
    let rows;
    try {
      rows = await parseFile(req.file.buffer, extension);
    } catch (error) {
      if (error.message === 'UNSUPPORTED_FORMAT') return sendError(res, errors.import.unsupportedFormat);
      return sendError(res, errors.import.invalidFile, `Không đọc được dữ liệu từ file: ${error.message}`);
    }

    if (!Array.isArray(rows) || rows.length === 0) return sendError(res, errors.import.invalidFile, 'File không có dữ liệu');

    const activeMask = await studentService.getActiveHobbyMask();
    const created = [];
    const failed = [];

    for (let index = 0; index < rows.length; index++) {
      const normalizedRow = normalizeMultipartBody(rows[index]);
      const validationMessage = validator.validateStudent(normalizedRow, true, activeMask);
      if (validationMessage) {
        failed.push({ row: index + 2, reason: validationMessage });
        continue;
      }

      try {
        created.push(await studentService.store(normalizedRow));
      } catch (error) {
        failed.push({
          row: index + 2,
          reason: error.code === '23505' ? 'Trùng code/email/username' : (error.message || 'Lỗi không xác định'),
        });
      }
    }

    return successResponse(res, { created, failed }, `Import thành công ${created.length} dòng, lỗi ${failed.length} dòng`);
  } catch (error) {
    error.fallbackCode = 'J600';
    throw error;
  }
});

// GET /student/export/:id
const exportOne = asyncHandler(async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const type = (req.query.type || 'xlsx').toLowerCase();
    if (!validator.isValidExportType(type)) return sendError(res, errors.export.invalid);

    const student = await studentService.getOneById(id);
    if (!student) return sendError(res, errors.export.notFound);

    const { buffer, contentType, extension } = buildFile([student], type);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="student-${id}.${extension}"`);
    return res.send(buffer);
  } catch (error) {
    error.fallbackCode = 'K600';
    throw error;
  }
});

// POST /student/export
const massExport = asyncHandler(async (req, res) => {
  try {
    const { idlist, type: rawType } = req.body;
    const type = (rawType || 'xlsx').toLowerCase();
    if (!Array.isArray(idlist) || idlist.length === 0) return sendError(res, errors.export.invalidIdList);
    if (!validator.isValidExportType(type)) return sendError(res, errors.export.invalid);

    const students = await studentService.getManyByIds(idlist);
    const { buffer, contentType, extension } = buildFile(students, type);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="students-export.${extension}"`);
    return res.send(buffer);
  } catch (error) {
    error.fallbackCode = 'K600';
    throw error;
  }
});

module.exports = {
  getAll,
  getByPage,
  getDeletedByPage,
  getById,
  store,
  update,
  destroy,
  massDestroy,
  restoreDeleted,
  permanentlyDelete,
  copyOne,
  massCopy,
  copyPreview,
  copyCommit,
  importStudents,
  exportOne,
  massExport,
};
