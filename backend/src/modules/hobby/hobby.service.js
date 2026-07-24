const pool = require('../../config/db');

// ============================================================
// 1. GET ALL (chỉ lấy hobby đang active)
// ============================================================
/**
 * Lấy toàn bộ hobby có is_active = true.
 * @returns {Promise<object[]>}
 */
const getAll = async () => {
  const sql = `
    SELECT id, code, name, bit_value, is_active
    FROM tra_hobby
    WHERE is_active = true
    ORDER BY bit_value ASC
  `;
  const result = await pool.query(sql);
  return result.rows;
};

// ============================================================
// 2. STORE (Tạo mới)
// ============================================================

/**
 * Tìm giá trị bit_value nhỏ nhất chưa được dùng trong toàn bảng.
 * Thuật toán: lấy tập hợp bit_value hiện có, duyệt lũy thừa 2 từ 1 (2^0)
 * lên tới 2^30, trả về giá trị đầu tiên không có trong tập hợp đó.
 * Giới hạn 2^30 để an toàn với integer 32-bit có dấu (max ~2.1 tỷ).
 *
 * @returns {Promise<number>} - Giá trị bit_value mới, hoặc -1 nếu đã hết
 */
const findNextBitValue = async () => {
  // Lấy tất cả bit_value đang tồn tại (kể cả is_active = false, vì UNIQUE tuyệt đối)
  const result = await pool.query('SELECT bit_value FROM tra_hobby');
  const existingBits = new Set(result.rows.map((r) => r.bit_value));

  const MAX_POWER = 30; // 2^30 = 1,073,741,824 — giới hạn an toàn cho INT4
  for (let i = 0; i <= MAX_POWER; i++) {
    const candidate = 1 << i; // dịch trái bit: 1, 2, 4, 8, 16, 32...
    if (!existingBits.has(candidate)) {
      return candidate;
    }
  }

  return -1; // đã dùng hết tất cả 31 bit — cực kỳ hiếm xảy ra
};

/**
 * Tạo mới một bản ghi hobby.
 * Chỉ nhận name từ client, tự sinh bit_value và code.
 * @param {string} name
 * @returns {Promise<object>} - Bản ghi hobby vừa tạo (đầy đủ field)
 */
const store = async (name) => {
  // Tính bit_value mới (lũy thừa 2 nhỏ nhất chưa dùng)
  const bitValue = await findNextBitValue();
  if (bitValue === -1) {
    // Ném lỗi đặc biệt để controller nhận ra và trả E604
    const err = new Error('Đã hết bit khả dụng cho hobbies');
    err.isBitExhausted = true;
    throw err;
  }

  // Sinh code theo format HB{bit_value} — unique vì bit_value unique
  const code = `HB${bitValue}`;

  const sql = `
    INSERT INTO tra_hobby (code, name, bit_value, is_active)
    VALUES ($1, $2, $3, true)
    RETURNING id, code, name, bit_value, is_active
  `;
  const result = await pool.query(sql, [code, name, bitValue]);
  return result.rows[0];
};

// ============================================================
// 3. DESTROY (Xóa 1)
// ============================================================

/**
 * Lấy thông tin hobby theo id (để lấy bit_value trước khi xóa).
 * @param {number} id
 * @returns {Promise<object|null>}
 */
const findById = async (id) => {
  const result = await pool.query(
    'SELECT id, code, name, bit_value, is_active FROM tra_hobby WHERE id = $1',
    [id]
  );
  return result.rows.length ? result.rows[0] : null;
};

/**
 * Kiểm tra bitmask: có sinh viên nào (chưa soft-delete) đang dùng bit này không.
 * Phép & là bitwise AND của Postgres — nếu kết quả != 0 nghĩa là bit đó đang được bật.
 * Dùng bit_value làm tham số parameterized để tránh SQL injection.
 *
 * @param {number} bitValue - Giá trị bit_value của hobby cần xóa
 * @returns {Promise<boolean>} - true nếu có sinh viên đang dùng
 */
const isUsedByStudent = async (bitValue) => {
  // Kiểm tra bitwise AND: (hobbies & bit_value) != 0 => sinh viên dùng hobby này
  const result = await pool.query(
    `SELECT 1 FROM tra_student WHERE (hobbies & $1) != 0 AND deleted_at IS NULL LIMIT 1`,
    [bitValue]
  );
  return result.rows.length > 0;
};

/**
 * Xóa một hobby theo id (hard delete).
 * @param {number} id
 * @returns {Promise<{ id: number }>}
 */
const destroy = async (id) => {
  const result = await pool.query(
    'DELETE FROM tra_hobby WHERE id = $1 RETURNING id',
    [id]
  );
  return result.rows.length ? { id: result.rows[0].id } : null;
};

module.exports = {
  getAll,
  store,
  findById,
  isUsedByStudent,
  destroy,
};
