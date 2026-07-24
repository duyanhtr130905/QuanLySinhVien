require('dotenv').config();
const express = require('express');
const cors = require('cors');
const errorHandler = require('./middlewares/errorHandler');
const classRoutes = require('./modules/class/class.routes');
const hobbyRoutes = require('./modules/hobby/hobby.routes');
const studentRoutes = require('./modules/student/student.routes');

const app = express();

// ============================================================
// MIDDLEWARE TOÀN CỤC
// ============================================================
app.use(cors()); // Cho phép frontend React gọi cross-origin
app.use(express.json()); // Parse body JSON

// ============================================================
// MOUNT ROUTES — KHÔNG có prefix /api hay /v1
// ============================================================
app.use('/class', classRoutes);
app.use('/hobby', hobbyRoutes);
app.use('/student', studentRoutes);

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Quản lý Sinh viên API đang hoạt động' });
});

// ============================================================
// ERROR HANDLER — phải đặt CUỐI CÙNG sau tất cả routes
// ============================================================
app.use(errorHandler);

module.exports = app;
