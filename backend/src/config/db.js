const { Pool } = require('pg');
require('dotenv').config();

// Khởi tạo pg Pool, đọc DATABASE_URL từ biến môi trường
// Supabase yêu cầu SSL — rejectUnauthorized: false để không cần certificate CA
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Kiểm tra kết nối khi khởi động
pool.on('connect', () => {
  console.log('✅ Kết nối PostgreSQL thành công');
});

pool.on('error', (err) => {
  console.error('❌ Lỗi PostgreSQL Pool:', err.message);
});

module.exports = pool;
