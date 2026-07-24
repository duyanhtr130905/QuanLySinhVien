const pool = require('../../config/db');
const { resolveColumns, resolveOrderBy, buildToplistClause } = require('../../utils/queryHelpers');
const { generateUniqueValue, runMassCopyTransaction } = require('../../utils/copyHelpers');

// ============================================================
// DANH SÁCH CỘT HỢP LỆ — dùng để validate columnlist
// ============================================================
const VALID_COLUMNS = ['id', 'code', 'name', 'description', 'created_at', 'updated_at'];
const DEFAULT_SELECT = VALID_COLUMNS.join(', ');

// Mapping alias ngắn (dùng trong param "order") -> tên cột thật
const COLUMN_ALIAS = {
  id: 'id',
  co: 'code',
  na: 'name',
  de: 'description',
  ca: 'created_at',
  ua: 'updated_at',
};

// ============================================================
// 1. GET ALL
// ============================================================
/**
 * Lấy toàn bộ danh sách lớp, hỗ trợ lọc cột qua columnlist.
 */
const getAll = async (columnlist) => {
  const cols = resolveColumns(VALID_COLUMNS, DEFAULT_SELECT, columnlist);
  const sql = `SELECT ${cols} FROM tra_class ORDER BY id ASC`;
  const result = await pool.query(sql);
  return result.rows;
};

// ============================================================
// 2. GET BY PAGE
// ============================================================
/**
 * Lấy danh sách lớp có phân trang, tìm kiếm, sắp xếp, ghim đầu.
 * @param {object} params
 * @param {number} params.page - Số trang (1-based)
 * @param {number} params.size - Số bản ghi mỗi trang
 * @param {string} [params.order] - Chuỗi sắp xếp VD: "co:1-na:0"
 * @param {string} [params.search] - Từ khóa tìm kiếm
 * @param {string} [params.columnlist] - Danh sách cột muốn lấy
 * @param {number[]} [params.toplist] - Danh sách id ghim đầu trang
 */
const getByPage = async ({ page, size, order, search, columnlist, toplist }) => {
  const cols = resolveColumns(VALID_COLUMNS, DEFAULT_SELECT, columnlist);
  const offset = (page - 1) * size;
  const queryParams = [];
  let paramIndex = 1;

  // Điều kiện tìm kiếm (ILIKE để không phân biệt hoa thường)
  let whereClause = '';
  if (search) {
    queryParams.push(`%${search}%`);
    whereClause = `WHERE (code ILIKE $${paramIndex} OR name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
    paramIndex++;
  }

  // Đếm tổng số bản ghi thỏa điều kiện
  const countSql = `SELECT COUNT(*) FROM tra_class ${whereClause}`;
  const countResult = await pool.query(countSql, queryParams);
  const totalItems = parseInt(countResult.rows[0].count, 10);
  const totalPages = Math.ceil(totalItems / size);

  // Xây ORDER BY
  const orderBy = resolveOrderBy(COLUMN_ALIAS, order) || 'ORDER BY id ASC';

  // Xử lý toplist: ghim các bản ghi có id thuộc toplist lên đầu
  const toplistClause = buildToplistClause(toplist);

  queryParams.push(size);
  queryParams.push(offset);

  const dataSql = `
    SELECT ${cols}
    FROM tra_class
    ${whereClause}
    ORDER BY ${toplistClause} ${orderBy.replace('ORDER BY ', '')}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const dataResult = await pool.query(dataSql, queryParams);

  return {
    page_info: {
      total_items: totalItems,
      total_pages: totalPages,
      current: page,
      size,
    },
    records: dataResult.rows,
  };
};

// ============================================================
// 3. STORE (Tạo mới)
// ============================================================
/**
 * Tạo mới một bản ghi lớp học.
 * @param {object} data - { code, name, description }
 * @returns {{ id: number }}
 */
const store = async ({ code, name, description }) => {
  const sql = `
    INSERT INTO tra_class (code, name, description, created_at, updated_at)
    VALUES ($1, $2, $3, NOW(), NOW())
    RETURNING id
  `;
  const result = await pool.query(sql, [code, name, description || null]);
  return { id: result.rows[0].id };
};

// ============================================================
// 4. UPDATE
// ============================================================
/**
 * Cập nhật một bản ghi lớp học theo id.
 * Chỉ cập nhật các field được cung cấp trong body (partial update).
 * @param {number} id
 * @param {object} body - { code, name, description } (có thể thiếu field)
 * @returns {{ id: number }}
 */
const update = async (id, body) => {
  // Xây động danh sách SET chỉ với các field được cung cấp
  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (body.code !== undefined) {
    fields.push(`code = $${paramIndex++}`);
    values.push(body.code);
  }
  if (body.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(body.name);
  }
  if (body.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(body.description);
  }

  // Luôn cập nhật updated_at
  fields.push(`updated_at = NOW()`);
  values.push(id);

  const sql = `
    UPDATE tra_class
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id
  `;

  const result = await pool.query(sql, values);
  return result.rows.length ? { id: result.rows[0].id } : null;
};

// ============================================================
// 5. DESTROY (Xóa 1)
// ============================================================
/**
 * Xóa một bản ghi lớp học theo id (hard delete).
 * @param {number} id
 * @returns {{ id: number }|null}
 */
const destroy = async (id) => {
  const sql = `DELETE FROM tra_class WHERE id = $1 RETURNING id`;
  const result = await pool.query(sql, [id]);
  return result.rows.length ? { id: result.rows[0].id } : null;
};

/**
 * Kiểm tra lớp có tồn tại không.
 * @param {number} id
 * @returns {boolean}
 */
const existsById = async (id) => {
  const result = await pool.query('SELECT 1 FROM tra_class WHERE id = $1', [id]);
  return result.rows.length > 0;
};

// ============================================================
// 6. MASS DELETE (Xóa nhiều)
// ============================================================
/**
 * Xóa nhiều lớp học cùng lúc.
 * Lớp nào có liên kết sinh viên (FK 23503) sẽ bị bỏ qua, lớp còn lại vẫn xóa.
 * @param {number[]} ids
 * @returns {{ deletedIds: number[], blockedIds: number[] }}
 */
const massDelete = async (ids) => {
  const deletedIds = [];
  const blockedIds = [];

  for (const id of ids) {
    try {
      const result = await pool.query(
        'DELETE FROM tra_class WHERE id = $1 RETURNING id',
        [id]
      );
      if (result.rows.length > 0) {
        deletedIds.push(result.rows[0].id);
      }
      // id không tồn tại thì bỏ qua (không thêm vào deleted cũng không báo lỗi)
    } catch (err) {
      // Lỗi 23503: vi phạm FK — còn sinh viên thuộc lớp này
      if (err.code === '23503') {
        blockedIds.push(id);
      } else {
        throw err; // Lỗi khác thì ném lên controller xử lý
      }
    }
  }

  return { deletedIds, blockedIds };
};

// ============================================================
// 7 & 8. COPY (1 lớp / nhiều lớp)
// ============================================================
/**
 * Sao chép một lớp học theo id — dùng pool trực tiếp (không transaction).
 * Dùng cho endpoint POST /class/copy/:id (copy đơn, 1 insert duy nhất).
 * @param {number} id
 * @returns {Promise<object|null>} - Bản ghi lớp mới (đầy đủ field) hoặc null nếu không tìm thấy
 */
const copyOne = async (id) => {
  const original = await pool.query('SELECT * FROM tra_class WHERE id = $1', [id]);
  if (original.rows.length === 0) return null;

  const source = original.rows[0];
  const newCode = await generateUniqueValue(pool, 'tra_class', 'code', source.code, 50);

  const sql = `
    INSERT INTO tra_class (code, name, description, created_at, updated_at)
    VALUES ($1, $2, $3, NOW(), NOW())
    RETURNING *
  `;
  const result = await pool.query(sql, [newCode, source.name, source.description]);
  return result.rows[0];
};

/**
 * Hàm nội bộ — sao chép 1 lớp trong phạm vi 1 transaction client.
 * Dùng client.query() thay vì pool.query() để tất cả câu lệnh
 * SELECT/INSERT nằm trong cùng transaction, đảm bảo tính nhất quán.
 *
 * Trả về null (không throw) khi id gốc không tồn tại — massCopy sẽ
 * ghi vào notFound và tiếp tục vòng lặp mà không rollback.
 *
 * @param {import('pg').PoolClient} client
 * @param {number} id
 * @returns {Promise<object|null>}
 */
const copyOneWithClient = async (client, id) => {
  const original = await client.query('SELECT * FROM tra_class WHERE id = $1', [id]);
  if (original.rows.length === 0) return null; // "not found" — không rollback

  const source = original.rows[0];
  // generateUniqueValue dùng cùng client để thấy code đã insert trong transaction
  const newCode = await generateUniqueValue(client, 'tra_class', 'code', source.code, 50);

  const sql = `
    INSERT INTO tra_class (code, name, description, created_at, updated_at)
    VALUES ($1, $2, $3, NOW(), NOW())
    RETURNING *
  `;
  const result = await client.query(sql, [newCode, source.name, source.description]);
  return result.rows[0];
};

/**
 * Sao chép nhiều lớp học cùng lúc trong 1 transaction.
 *
 * - Nếu id gốc không tồn tại: bỏ qua, thêm vào notFound, KHÔNG rollback.
 * - Nếu có lỗi DB bất ngờ (ngoài "not found"): ROLLBACK toàn bộ, throw lỗi
 *   lên controller (controller đã bắt với fallbackCode = 'H600').
 *
 * @param {number[]} idlist
 * @returns {Promise<{ created: object[], notFound: number[] }>}
 */
const massCopy = (idlist) => runMassCopyTransaction(pool, copyOneWithClient, idlist);

module.exports = {
  getAll,
  getByPage,
  store,
  update,
  destroy,
  existsById,
  massDelete,
  copyOne,
  massCopy,
};
