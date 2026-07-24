const express = require('express');
const router = express.Router();
const controller = require('./hobby.controller');

// Lấy toàn bộ danh sách sở thích (is_active = true)
router.get('/', controller.getAll);

// Tạo mới sở thích
router.post('/', controller.store);

// Xóa sở thích theo id
router.delete('/:id', controller.destroy);

module.exports = router;
