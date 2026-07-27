const pool = require('../../config/db');
const bcrypt = require('bcrypt');
const createListRepository = require('../../core/database/createListRepository');
const { generateUniqueValue, runMassCopyTransaction } = require('../../utils/copyHelpers');

const SALT_ROUNDS = 10;

// ============================================================
// DANH SÁCH CỘT HỢP LỆ (không có password, hobbies, attachment)
// ============================================================
const VALID_COLUMNS = [
  'id', 'code', 'fullname', 'dob', 'sex', 'homecity', 'address',
  'hair_color', 'email', 'facebook', 'class_id', 'username',
  'description', 'hobbies', 'attachment', 'created_at', 'updated_at', 'deleted_at',
];

// Cột mặc định khi SELECT — KHÔNG bao giờ chứa password
const DEFAULT_SELECT = [
  'id', 'code', 'fullname', 'dob', 'sex', 'homecity', 'address',
  'hair_color', 'email', 'facebook', 'class_id', 'username',
  'description', 'hobbies', 'attachment', 'created_at', 'updated_at', 'deleted_at',
].join(', ');

// Mapping alias ngắn (dùng trong param "order") -> tên cột thật
const COLUMN_ALIAS = {
  id: 'id',
  co: 'code',
  fn: 'fullname',
  do: 'dob',
  sx: 'sex',
  hc: 'homecity',
  ad: 'address',
  hr: 'hair_color',
  em: 'email',
  fb: 'facebook',
  ci: 'class_id',
  un: 'username',
  de: 'description',
  ca: 'created_at',
  ua: 'updated_at',
};

const listRepository = createListRepository({
  pool,
  tableName: 'tra_student',
  validColumns: VALID_COLUMNS,
  defaultColumns: VALID_COLUMNS,
  columnAliases: COLUMN_ALIAS,
  searchColumns: ['fullname', 'description', 'email'],
  deletedFilter: 'deleted_at IS NULL',
  defaultOrder: 'ORDER BY id ASC',
});

// ============================================================
// 1. GET ALL
// ============================================================
/**
 * Lấy toàn bộ sinh viên chưa bị soft-delete.
 * Bắt buộc thêm deleted_at IS NULL — sinh viên đã xóa không được xuất hiện.
 */
// ============================================================
// 2. GET BY PAGE
// ============================================================
/**
 * Lấy danh sách sinh viên có phân trang, tìm kiếm, sắp xếp, ghim đầu.
 * Search theo fullname, description, email (ILIKE).
 * Luôn lọc deleted_at IS NULL.
 */
  // WHERE base: chỉ lấy sinh viên chưa xóa
  // Thêm điều kiện search nếu có (ILIKE — không phân biệt hoa thường)
  // Đếm tổng số bản ghi thỏa điều kiện (dùng cùng queryParams)
  // Xây ORDER BY
  // Toplist: ghim các id lên đầu bằng CASE WHEN trong ORDER BY
// ============================================================
// 3. STORE (Tạo mới)
// ============================================================
/**
 * Tạo mới một bản ghi sinh viên.
 * Password được hash bằng bcrypt trước khi insert.
 * RETURNING liệt kê rõ cột — KHÔNG có password trong response.
 */
const { getAll, getByPage } = listRepository;

const store = async (data) => {
  const {
    code, fullname, dob, sex, homecity, address,
    hair_color, email, facebook, class_id, username, password, description,
    hobbies, attachment,
  } = data;

  // Hash password trước khi lưu vào DB
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const sql = `
    INSERT INTO tra_student
      (code, fullname, dob, sex, homecity, address, hair_color,
       email, facebook, class_id, username, password, description,
       hobbies, attachment, created_at, updated_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7,
       $8, $9, $10, $11, $12, $13,
       $14, $15, NOW(), NOW())
    RETURNING
      id, code, fullname, dob, sex, homecity, address, hair_color,
      email, facebook, class_id, username, description,
      hobbies, attachment, created_at, updated_at, deleted_at
  `;

  const values = [
    code, fullname, dob || null, sex ?? null, homecity || null, address || null,
    hair_color || null, email, facebook || null, class_id || null,
    username, hashedPassword, description || null,
    hobbies ?? 0, attachment || null,
  ];

  const result = await pool.query(sql, values);
  return result.rows[0];
};

// ============================================================
// 4. UPDATE
// ============================================================
/**
 * Cập nhật bản ghi sinh viên theo id.
 * - Chỉ tìm bản ghi có deleted_at IS NULL (đã xóa mềm -> coi như không tồn tại).
 * - code và username bị loại bỏ khỏi danh sách update (không thể đổi sau khi tạo).
 * - password nếu có -> hash lại trước khi update.
 * - Chỉ build SET cho các field thực sự có trong body (partial update).
 */
const update = async (id, body) => {
  // Các field được phép update qua whitelist (loại bỏ code, username)
  // hobbies và attachment xử lý riêng bên dưới vì cần logic đặc biệt
  const UPDATABLE = [
    'fullname', 'dob', 'sex', 'homecity', 'address',
    'hair_color', 'email', 'facebook', 'class_id', 'description',
  ];

  const fields = [];
  const values = [];
  let paramIndex = 1;

  for (const field of UPDATABLE) {
    if (body[field] !== undefined) {
      fields.push(`${field} = $${paramIndex++}`);
      values.push(body[field] === '' ? null : body[field]);
    }
  }

  // Xử lý hobbies (bitmask integer)
  if (body.hobbies !== undefined) {
    fields.push(`hobbies = $${paramIndex++}`);
    values.push(body.hobbies);
  }

  // Xử lý attachment (url ảnh do controller gán sau khi upload Supabase Storage)
  if (body.attachment !== undefined) {
    fields.push(`attachment = $${paramIndex++}`);
    values.push(body.attachment || null);
  }

  // Xử lý password riêng vì cần hash
  if (body.password !== undefined) {
    const hashed = await bcrypt.hash(body.password, SALT_ROUNDS);
    fields.push(`password = $${paramIndex++}`);
    values.push(hashed);
  }

  // Luôn cập nhật updated_at
  fields.push(`updated_at = NOW()`);

  // id điều kiện WHERE
  values.push(id);

  const sql = `
    UPDATE tra_student
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex} AND deleted_at IS NULL
    RETURNING
      id, code, fullname, dob, sex, homecity, address, hair_color,
      email, facebook, class_id, username, description,
      hobbies, attachment, created_at, updated_at, deleted_at
  `;

  const result = await pool.query(sql, values);
  return result.rows.length ? result.rows[0] : null;
};

// ============================================================
// 5. DESTROY (Soft-delete qua trigger DB)
// ============================================================
/**
 * "Xóa" sinh viên — thực chất trigger DB tự set deleted_at.
 * Backend chỉ cần DELETE WHERE id AND deleted_at IS NULL.
 * Nếu không có row nào bị ảnh hưởng -> bản ghi không tồn tại hoặc đã xóa rồi.
 */
const destroy = async (id) => {
  // Kiểm tra tồn tại (và chưa bị soft-delete) TRƯỚC — vì DELETE...RETURNING sẽ luôn rỗng
  // do trigger BEFORE DELETE trả NULL để hủy DELETE gốc (chuyển thành soft-delete nội bộ).
  const existing = await pool.query(
    'SELECT id FROM tra_student WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  if (existing.rows.length === 0) return null; // không tồn tại hoặc đã bị xóa từ trước

  // Gọi DELETE — trigger sẽ tự chuyển thành UPDATE deleted_at = now(), không xóa thật.
  // Không dùng RETURNING ở đây vì sẽ luôn rỗng, không phản ánh đúng kết quả.
  await pool.query('DELETE FROM tra_student WHERE id = $1', [id]);

  return { id };
};

// ============================================================
// MASS DESTROY (nhiều sinh viên trong 1 transaction)
// ============================================================
/**
 * Xóa mềm nhiều sinh viên cùng lúc trong 1 transaction.
 * - Id không tồn tại (hoặc đã soft-delete từ trước): bỏ qua, thêm vào notFound, KHÔNG rollback.
 * - Lỗi DB bất ngờ: ROLLBACK toàn bộ, throw lỗi lên controller.
 *
 * @param {number[]} idlist
 * @returns {Promise<{ deleted: number[], notFound: number[] }>}
 */
const massDestroy = async (idlist) => {
  const client = await pool.connect();
  const deleted = [];
  const notFound = [];

  try {
    await client.query('BEGIN');

    for (const id of idlist) {
      // Kiểm tra tồn tại (và chưa bị soft-delete) TRƯỚC — giống logic destroy() đơn lẻ
      const existing = await client.query(
        'SELECT id FROM tra_student WHERE id = $1 AND deleted_at IS NULL',
        [id]
      );

      if (existing.rows.length === 0) {
        notFound.push(id); // không tồn tại hoặc đã xóa từ trước — bỏ qua, không rollback
        continue;
      }

      // Trigger DB sẽ tự chuyển DELETE thành UPDATE deleted_at = now()
      await client.query('DELETE FROM tra_student WHERE id = $1', [id]);
      deleted.push(id);
    }

    await client.query('COMMIT');
    return { deleted, notFound };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ============================================================
// HOBBY MASK
// ============================================================
/**
 * Tính tổng bitmask của tất cả hobby đang active.
 * Dùng để validate giá trị hobbies của sinh viên:
 * (hobbies & ~activeMask) === 0 <=> tất cả bit trong hobbies đều thuộc mask hợp lệ.
 */
const getActiveHobbyMask = async () => {
  const result = await pool.query('SELECT bit_value FROM tra_hobby WHERE is_active = true');
  return result.rows.reduce((mask, row) => mask | row.bit_value, 0);
};

// ============================================================
// SUPABASE STORAGE
// ============================================================
/**
 * Upload file ảnh lên Supabase Storage bucket 'student-attachments'.
 * Path file: students/{code}-{timestamp}.{ext} để tránh trùng tên.
 * @param {Express.Multer.File} file - File object từ multer (memoryStorage)
 * @param {string} studentCode - Mã sinh viên, dùng để đặt tên file
 * @returns {Promise<string>} - Public URL của file vừa upload
 */
const uploadAttachment = async (file, studentCode) => {
  const supabase = require('../../config/supabaseStorage');
  const ext = file.originalname.split('.').pop();
  const path = `students/${studentCode}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('student-attachments')
    .upload(path, file.buffer, { contentType: file.mimetype });
  if (error) throw new Error('UPLOAD_FAILED: ' + error.message);
  const { data } = supabase.storage.from('student-attachments').getPublicUrl(path);
  return data.publicUrl;
};

/**
 * Xóa file ảnh cũ khỏi Supabase Storage theo public URL.
 * Lấy lại path từ URL bằng cách tách sau '/student-attachments/'.
 * Không throw nếu url null/undefined (ảnh chưa có thì bỏ qua).
 * @param {string|null} url - Public URL của file cần xóa
 */
const deleteAttachment = async (url) => {
  if (!url) return;
  const supabase = require('../../config/supabaseStorage');
  const path = url.split('/student-attachments/')[1];
  if (path) await supabase.storage.from('student-attachments').remove([path]);
};

/**
 * Lấy attachment (url) hiện tại của 1 sinh viên.
 * Dùng trước khi update để biết ảnh cũ cần xóa.
 * Chỉ tìm bản ghi chưa bị soft-delete.
 * @param {number} id
 * @returns {Promise<string|null>}
 */
const getAttachmentById = async (id) => {
  const result = await pool.query(
    'SELECT attachment FROM tra_student WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  return result.rows.length ? result.rows[0].attachment : null;
};

// ============================================================
// COPY ONE (trong phạm vi 1 transaction client)
// ============================================================

/**
 * Sao chép 1 sinh viên trong phạm vi 1 transaction client.
 * - Copy nguyên hash password cũ (KHÔNG hash lại).
 * - Sinh code, username, email mới unique.
 * - Giữ nguyên: hobbies, class_id, attachment (share URL ảnh), sex, dob, etc.
 * - Trả null nếu id gốc không tồn tại hoặc đã soft-delete.
 *
 * @param {import('pg').PoolClient} client
 * @param {number} id
 * @returns {Promise<object|null>}
 */
const copyOneWithClient = async (client, id) => {
  const original = await client.query(
    'SELECT * FROM tra_student WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  if (original.rows.length === 0) return null;

  const source = original.rows[0];
  const newCode = await generateUniqueValue(client, 'tra_student', 'code', source.code, 50);
  const newUsername = await generateUniqueValue(client, 'tra_student', 'username', source.username, 50);
  const newEmail = await generateUniqueValue(client, 'tra_student', 'email', source.email, 256);

  const sql = `
    INSERT INTO tra_student
      (code, fullname, dob, sex, homecity, address, hair_color,
       email, facebook, class_id, username, password, description,
       hobbies, attachment, created_at, updated_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7,
       $8, $9, $10, $11, $12, $13,
       $14, $15, NOW(), NOW())
    RETURNING
      id, code, fullname, dob, sex, homecity, address, hair_color,
      email, facebook, class_id, username, description,
      hobbies, attachment, created_at, updated_at, deleted_at
  `;

  const values = [
    newCode, source.fullname, source.dob, source.sex,
    source.homecity, source.address, source.hair_color,
    newEmail, source.facebook, source.class_id,
    newUsername, source.password, source.description,
    source.hobbies, source.attachment,
  ];

  const result = await client.query(sql, values);
  return result.rows[0];
};


/**
 * Sao chép 1 sinh viên — dùng cho endpoint POST /student/copy/:id.
 * Lấy 1 client từ pool (không cần transaction vì chỉ 1 insert).
 * @param {number} id
 * @returns {Promise<object|null>}
 */
const copyOne = async (id) => {
  const client = await pool.connect();
  try {
    return await copyOneWithClient(client, id);
  } finally {
    client.release();
  }
};

// ============================================================
// MASS COPY (nhiều sinh viên trong 1 transaction)
// ============================================================

/**
 * Sao chép nhiều sinh viên cùng lúc trong 1 transaction.
 * - Id gốc không tồn tại: bỏ qua, thêm vào notFound, KHÔNG rollback.
 * - Lỗi DB bất ngờ: ROLLBACK toàn bộ, throw lỗi lên controller.
 *
 * @param {number[]} idlist
 * @returns {Promise<{ created: object[], notFound: number[] }>}
 */
const massCopy = (idlist) => runMassCopyTransaction(pool, copyOneWithClient, idlist);


// ============================================================
// EXPORT HELPERS
// ============================================================

/**
 * Lấy nhiều sinh viên theo danh sách id (dùng cho mass export).
 * Chỉ lấy sinh viên chưa soft-delete, SELECT đầy đủ trừ password.
 * @param {number[]} ids
 * @returns {Promise<object[]>}
 */
const getManyByIds = async (ids) => {
  if (!ids || ids.length === 0) return [];
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `
    SELECT ${DEFAULT_SELECT}
    FROM tra_student
    WHERE id IN (${placeholders}) AND deleted_at IS NULL
    ORDER BY id ASC
  `;
  const result = await pool.query(sql, ids);
  return result.rows;
};

/**
 * Lấy 1 sinh viên đầy đủ trừ password (dùng cho export 1).
 * @param {number} id
 * @returns {Promise<object|null>}
 */
const getOneById = async (id) => {
  const sql = `
    SELECT ${DEFAULT_SELECT}
    FROM tra_student
    WHERE id = $1 AND deleted_at IS NULL
  `;
  const result = await pool.query(sql, [id]);
  return result.rows.length ? result.rows[0] : null;
};

module.exports = {

  getAll, getByPage, store, update, destroy,massDestroy,
  getActiveHobbyMask,
  uploadAttachment, deleteAttachment, getAttachmentById,
  copyOne, massCopy, getManyByIds, getOneById,
};
