const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const validateImageMetadata = (file) => {
  if (!file) return;
  if (!ALLOWED_IMAGE_TYPES.has(file.mimetype) || (file.size !== undefined && file.size > MAX_IMAGE_SIZE)) {
    const error = new Error('INVALID_FILE_METADATA');
    error.code = 'INVALID_FILE_METADATA';
    throw error;
  }
};

const prepareCreateAttachment = async (file, studentCode, storage) => {
  if (!file) return null;
  validateImageMetadata(file);
  return storage.uploadAttachment(file, studentCode);
};

const prepareUpdateAttachment = async (file, studentId, storage) => {
  if (!file) return { newAttachmentUrl: undefined, oldAttachmentUrl: null };
  validateImageMetadata(file);
  const oldAttachmentUrl = await storage.getAttachmentById(studentId);
  const newAttachmentUrl = await storage.uploadAttachment(file, `id${studentId}`);
  return { newAttachmentUrl, oldAttachmentUrl };
};

const cleanupNewAttachment = async (url, storage, { suppressErrors = true } = {}) => {
  if (!url) return;
  if (suppressErrors) await storage.deleteAttachment(url).catch(() => {});
  else await storage.deleteAttachment(url);
};

const cleanupOldAttachmentAfterUpdate = async ({ newAttachmentUrl, oldAttachmentUrl }, storage) => {
  if (newAttachmentUrl && oldAttachmentUrl && oldAttachmentUrl !== newAttachmentUrl) {
    await storage.deleteAttachment(oldAttachmentUrl);
  }
};

module.exports = {
  validateImageMetadata,
  prepareCreateAttachment,
  prepareUpdateAttachment,
  cleanupNewAttachment,
  cleanupOldAttachmentAfterUpdate,
};
