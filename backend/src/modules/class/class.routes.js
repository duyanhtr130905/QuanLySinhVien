const express = require('express');
const router = express.Router();
const controller = require('./class.controller');

// ============================================================
// QUAN TRỌNG: Các route có path cố định (như /delete, /copy, /page)
// phải được khai báo TRƯỚC route có :id để tránh Express match nhầm.
// ============================================================

// Phân trang
router.get('/page', controller.getByPage);
router.get('/page/:init', controller.getByPage);

// Xóa nhiều (path cố định /delete phải trước /:id)
router.delete('/delete', controller.massDelete);

// Sao chép nhiều (path cố định /copy phải trước /copy/:id)
router.post('/copy', controller.massCopy);

// Sao chép 1 lớp
router.post('/copy/:id', controller.copyOne);

// Lấy toàn bộ danh sách
router.get('/', controller.getAll);

// Tạo mới
router.post('/', controller.store);

// Cập nhật
router.put('/:id', controller.update);

// Xóa 1 lớp
router.delete('/:id', controller.destroy);

module.exports = router;
