const express = require('express');
const router = express.Router();
const multer = require('multer');
const controller = require('./student.controller');
const { errorResponse } = require('../../utils/response');

// ============================================================
// MULTER CONFIG
// memoryStorage: không ghi ra đĩa, giữ buffer để forward thẳng lên Supabase Storage
// ============================================================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // tối đa 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('INVALID_FILE_TYPE'));
    }
    cb(null, true);
  },
});

// ============================================================
// MULTER ERROR HANDLER (middleware nội tuyến)
// Đặt NGAY SAU upload.single(), TRƯỚC controller.
// Bắt lỗi file sai định dạng / quá dung lượng -> trả E603 rõ ràng.
// Không để lỗi rơi xuống errorHandler chung (message sẽ không thân thiện).
// ============================================================
const handleMulterError = (err, req, res, next) => {
  if (err) {
    if (err.message === 'INVALID_FILE_TYPE' || err.code === 'LIMIT_FILE_SIZE') {
      return errorResponse(res, 400, 'E603', 'Ảnh phải là jpg/jpeg/png, tối đa 5MB');
    }
    return next(err); // Lỗi multer khác -> chuyển lên errorHandler chung
  }
  next();
};

// ============================================================
// MULTER CONFIG — FILE DỮ LIỆU (import csv/xlsx/json/xml)
// Không giới hạn mimetype (không phải ảnh), tối đa 10MB
// ============================================================
const uploadDataFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ============================================================
// ROUTES
// Route cố định trước route có :id để tránh Express match nhầm
// ============================================================

// Phân trang
router.get('/page', controller.getByPage);
router.get('/page/:init', controller.getByPage);

// Th\u00f9ng r\u00e1c ph\u1ea3i \u0111\u1eb7t tr\u01b0\u1edbc /:id \u0111\u1ec3 Express kh\u00f4ng match nh\u1ea7m.
router.get('/deleted/page', controller.getDeletedByPage);
router.patch('/deleted/restore', controller.restoreDeleted);
router.delete('/deleted/permanent', controller.permanentlyDelete);

// Sao chép (path cố định /copy phải trước /copy/:id)
router.post('/copy', controller.massCopy);
router.post('/copy/preview', controller.copyPreview);
router.post('/copy/validate', controller.copyValidate);
router.post('/copy/commit', upload.any(), handleMulterError, controller.copyCommit);
router.post('/copy/:id', controller.copyOne);

// Import file dữ liệu (csv/xlsx/json/xml)
router.get('/import/template', controller.importTemplate);
router.post('/import', uploadDataFile.single('file'), controller.importStudents);
router.post('/import/validate', controller.importValidate);
router.post('/import/commit', controller.importCommit);

// Export (path cố định /export phải trước /export/:id)
router.post('/export', controller.massExport);
router.get('/export/:id', controller.exportOne);

// Lấy toàn bộ danh sách
router.get('/', controller.getAll);

// Xem chi tiết 1 sinh viên — đặt CUỐI nhóm GET để không nuốt mất các path cố định bên trên
router.get('/:id', controller.getById);

// Tạo mới — nhận multipart/form-data (có thể kèm file ảnh "attachment")
router.post('/', upload.single('attachment'), handleMulterError, controller.store);

// Cập nhật — nhận multipart/form-data (có thể kèm file ảnh "attachment" mới)
router.put('/:id', upload.single('attachment'), handleMulterError, controller.update);

// Xóa nhiều (soft-delete qua trigger DB)
router.delete('/', controller.massDestroy);

// Xóa một (soft-delete qua trigger DB)
router.delete('/:id', controller.destroy);

module.exports = router;
