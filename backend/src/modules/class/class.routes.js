const express = require('express');
const multer = require('multer');
const { errorResponse } = require('../../utils/response');
const controller = require('./class.controller');

const router = express.Router();
const uploadDataFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const handleImportUploadError = (err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return errorResponse(res, 400, 'J604', 'File không được vượt quá 10MB');
  }
  if (err) return next(err);
  return next();
};

// Fixed paths are declared before /:id routes.
router.get('/page', controller.getByPage);
router.get('/page/:init', controller.getByPage);
router.delete('/delete', controller.massDelete);
router.post('/copy', controller.massCopy);
router.post('/copy/:id', controller.copyOne);
router.post('/import', uploadDataFile.single('file'), handleImportUploadError, controller.importClasses);
router.post('/export', controller.massExport);
router.get('/export/:id', controller.exportOne);

router.get('/', controller.getAll);
router.post('/', controller.store);

router.get('/:id/students', controller.getStudents);
router.post('/:id/students', controller.assignStudents);
router.delete('/:id/students/:studentId', controller.removeStudent);
router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.delete('/:id', controller.destroy);

module.exports = router;
