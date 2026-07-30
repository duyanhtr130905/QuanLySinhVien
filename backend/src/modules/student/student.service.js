const pool = require('../../config/db');
const bcrypt = require('bcrypt');
const createListRepository = require('../../core/database/createListRepository');
const { generateUniqueValue, getCopyCandidateBatch, runMassCopyTransaction } = require('../../utils/copyHelpers');

const SALT_ROUNDS = 10;

// ============================================================
// DANH SÁCH CỘT HỢP LỆ (không có password)
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

const deletedListRepository = createListRepository({
  pool,
  tableName: 'tra_student',
  validColumns: VALID_COLUMNS,
  defaultColumns: VALID_COLUMNS,
  columnAliases: { ...COLUMN_ALIAS, da: 'deleted_at' },
  searchColumns: ['fullname', 'description', 'email'],
  deletedFilter: 'deleted_at IS NOT NULL',
  defaultOrder: 'ORDER BY deleted_at DESC, id DESC',
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
const { getByPage: getDeletedByPage } = deletedListRepository;

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

const normalizeTrashIds = (idlist) => [...new Set((Array.isArray(idlist) ? idlist : [])
  .map(Number)
  .filter((id) => Number.isSafeInteger(id) && id > 0))];

const getRestoreConflicts = async (client, student) => {
  const result = await client.query(
    `SELECT code, email, username
     FROM tra_student
     WHERE deleted_at IS NULL
       AND (code = $1 OR email = $2 OR username = $3)
     LIMIT 1`,
    [student.code, student.email, student.username]
  );
  return result.rows.length > 0;
};

const restoreDeleted = async (idlist) => {
  const ids = normalizeTrashIds(idlist);
  const client = await pool.connect();
  const restored = [];
  const notFound = [];
  const conflicts = [];

  try {
    await client.query('BEGIN');
    for (const id of ids) {
      const found = await client.query(
        `SELECT id, code, email, username
         FROM tra_student
         WHERE id = $1 AND deleted_at IS NOT NULL
         FOR UPDATE`,
        [id]
      );
      if (!found.rows.length) {
        notFound.push(id);
        continue;
      }
      if (await getRestoreConflicts(client, found.rows[0])) {
        conflicts.push(id);
        continue;
      }

      await client.query('SAVEPOINT restore_student');
      try {
        const updated = await client.query(
          'UPDATE tra_student SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id',
          [id]
        );
        if (updated.rows.length) restored.push(id);
        else notFound.push(id);
      } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT restore_student');
        if (error.code === '23505') conflicts.push(id);
        else throw error;
      }
    }
    await client.query('COMMIT');
    return { restored, notFound, conflicts };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const permanentlyDelete = async (idlist) => {
  const ids = normalizeTrashIds(idlist);
  const client = await pool.connect();
  const deleted = [];
  const notFound = [];
  const attachmentCandidates = [];

  try {
    await client.query('BEGIN');
    for (const id of ids) {
      const removed = await client.query(
        `DELETE FROM tra_student
         WHERE id = $1 AND deleted_at IS NOT NULL
         RETURNING id, attachment`,
        [id]
      );
      if (!removed.rows.length) {
        notFound.push(id);
        continue;
      }
      deleted.push(id);
      if (removed.rows[0].attachment) attachmentCandidates.push(removed.rows[0].attachment);
    }

    const attachmentsToDelete = [];
    for (const attachment of [...new Set(attachmentCandidates)]) {
      const references = await client.query(
        'SELECT COUNT(*) AS count FROM tra_student WHERE attachment = $1',
        [attachment]
      );
      if (Number(references.rows[0].count) === 0) attachmentsToDelete.push(attachment);
    }
    await client.query('COMMIT');
    return { deleted, notFound, attachmentsToDelete };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
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
  if (path) {
    const { error } = await supabase.storage.from('student-attachments').remove([path]);
    if (error) throw error;
  }
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

const COPY_VALUE_COLUMNS = [
  'code', 'fullname', 'dob', 'sex', 'homecity', 'address', 'hair_color',
  'email', 'facebook', 'class_id', 'username', 'description', 'hobbies', 'attachment',
];

const pickCopyValues = source => COPY_VALUE_COLUMNS.reduce((values, key) => ({
  ...values,
  [key]: source[key] == null ? null : source[key],
}), {});

const COPY_CANDIDATE_ATTEMPTS = 100;

const selectAvailableCopyValue = (column, originalValue, maxLength, occupied, reserved) => {
  const candidate = getCopyCandidateBatch(column, originalValue, maxLength, COPY_CANDIDATE_ATTEMPTS)
    .find((value) => !occupied.has(value) && !reserved.has(value));
  if (!candidate) {
    const error = new Error(`KhÃ´ng thá»ƒ táº¡o giÃ¡ trá»‹ duy nháº¥t cho ${column}`);
    error.code = 'COPY_DUPLICATE';
    throw error;
  }
  reserved.add(candidate);
  return candidate;
};

const getCopyPreview = async (idlist) => {
  const ids = [...new Set(idlist)];
  const sourcesResult = await pool.query(
    `SELECT ${DEFAULT_SELECT} FROM tra_student WHERE id = ANY($1::int[]) AND deleted_at IS NULL`,
    [ids]
  );
  const sourcesById = new Map(sourcesResult.rows.map((row) => [Number(row.id), row]));
  const sourceRows = ids.map((id) => sourcesById.get(Number(id))).filter(Boolean);
  const candidateSets = { code: new Set(), username: new Set(), email: new Set() };
  sourceRows.forEach((source) => {
    getCopyCandidateBatch('code', source.code, 50, COPY_CANDIDATE_ATTEMPTS).forEach(value => candidateSets.code.add(value));
    getCopyCandidateBatch('username', source.username, 50, COPY_CANDIDATE_ATTEMPTS).forEach(value => candidateSets.username.add(value));
    getCopyCandidateBatch('email', source.email, 256, COPY_CANDIDATE_ATTEMPTS).forEach(value => candidateSets.email.add(value));
  });
  const existingResult = await pool.query(
    `SELECT code, username, email FROM tra_student
     WHERE code = ANY($1::text[]) OR username = ANY($2::text[]) OR email = ANY($3::text[])`,
    [[...candidateSets.code], [...candidateSets.username], [...candidateSets.email]]
  );
  const occupied = { code: new Set(), username: new Set(), email: new Set() };
  existingResult.rows.forEach((row) => {
    occupied.code.add(row.code);
    occupied.username.add(row.username);
    occupied.email.add(row.email);
  });
  const reserved = { code: new Set(), username: new Set(), email: new Set() };
  const drafts = [];
  const notFoundIds = [];
  ids.forEach((id) => {
    const source = sourcesById.get(Number(id));
    if (!source) {
      notFoundIds.push(id);
      return;
    }
    const values = pickCopyValues(source);
    values.code = selectAvailableCopyValue('code', values.code, 50, occupied.code, reserved.code);
    values.username = selectAvailableCopyValue('username', values.username, 50, occupied.username, reserved.username);
    values.email = selectAvailableCopyValue('email', values.email, 256, occupied.email, reserved.email);
    drafts.push({ draftKey: `student-${id}`, sourceId: id, values });
  });
  return { drafts, notFoundIds };
};

const copyRowError = (draftKey, errors) => ({ draftKey, status: Object.keys(errors).length ? 'invalid' : 'valid', errors });
const normalizedCopyText = value => typeof value === 'string' ? value.trim() : '';

const validateCopyDrafts = async (drafts) => {
  const rows = (Array.isArray(drafts) ? drafts : []).map((draft, index) => {
    const raw = draft?.values || {};
    const errors = {};
    const code = normalizedCopyText(raw.code);
    const fullname = normalizedCopyText(raw.fullname);
    const username = normalizedCopyText(raw.username);
    const email = normalizedCopyText(raw.email).toLowerCase();
    const classId = raw.class_id === '' || raw.class_id == null ? null : Number(raw.class_id);
    if (!draft?.draftKey || typeof draft.draftKey !== 'string') errors.draftKey = `Draft ${index + 1} khÃ´ng há»£p lá»‡`;
    if (!Number.isSafeInteger(Number(draft?.sourceId)) || Number(draft.sourceId) <= 0) errors.sourceId = 'Báº£n ghi gá»‘c khÃ´ng há»£p lá»‡';
    if (!code) errors.code = 'MÃ£ sinh viÃªn lÃ  báº¯t buá»™c'; else if (code.length > 50) errors.code = 'MÃ£ sinh viÃªn khÃ´ng Ä‘Æ°á»£c vÆ°á»£t quÃ¡ 50 kÃ½ tá»±';
    if (!fullname) errors.fullname = 'Há» tÃªn lÃ  báº¯t buá»™c'; else if (fullname.length > 30) errors.fullname = 'Há» tÃªn khÃ´ng Ä‘Æ°á»£c vÆ°á»£t quÃ¡ 30 kÃ½ tá»±';
    if (!username) errors.username = 'Username lÃ  báº¯t buá»™c'; else if (username.length > 50) errors.username = 'Username khÃ´ng Ä‘Æ°á»£c vÆ°á»£t quÃ¡ 50 kÃ½ tá»±';
    if (!email) errors.email = 'Email lÃ  báº¯t buá»™c'; else if (email.length > 256 || !/^[0-9a-zA-Z.\-_]+@[0-9a-zA-Z.\-_]+$/.test(email)) errors.email = 'Email khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng';
    if (classId !== null && (!Number.isSafeInteger(classId) || classId <= 0)) errors.class_id = 'ID lá»›p khÃ´ng há»£p lá»‡';
    if (raw.hobbies !== undefined && raw.hobbies !== null && raw.hobbies !== '' && (!Number.isInteger(Number(raw.hobbies)) || Number(raw.hobbies) < 0)) errors.hobbies = 'Sá»Ÿ thÃ­ch khÃ´ng há»£p lá»‡';
    return { draft, code, username, email, classId, errors };
  });
  ['code', 'username', 'email'].forEach((field) => {
    const counts = new Map();
    rows.forEach((row) => { if (row[field]) counts.set(row[field], (counts.get(row[field]) || 0) + 1); });
    rows.forEach((row) => { if (row[field] && counts.get(row[field]) > 1) row.errors[field] = `${field} bá»‹ trÃ¹ng trong cÃ¡c báº£n sao`; });
  });
  const validValues = field => [...new Set(rows.filter(row => !row.errors[field] && row[field]).map(row => row[field]))];
  const classIds = [...new Set(rows.filter(row => !row.errors.class_id && row.classId !== null).map(row => row.classId))];
  const [existingResult, classesResult] = await Promise.all([
    pool.query(
      'SELECT code, username, email FROM tra_student WHERE code = ANY($1::text[]) OR username = ANY($2::text[]) OR email = ANY($3::text[])',
      [validValues('code'), validValues('username'), validValues('email')]
    ),
    classIds.length ? pool.query('SELECT id FROM tra_class WHERE id = ANY($1::int[])', [classIds]) : Promise.resolve({ rows: [] }),
  ]);
  const existing = { code: new Set(), username: new Set(), email: new Set() };
  existingResult.rows.forEach((row) => ['code', 'username', 'email'].forEach((field) => { if (row[field]) existing[field].add(row[field]); }));
  const classIdsInDb = new Set(classesResult.rows.map(row => Number(row.id)));
  rows.forEach((row) => {
    ['code', 'username', 'email'].forEach((field) => { if (!row.errors[field] && existing[field].has(row[field])) row.errors[field] = `${field} Ä‘Ã£ tá»“n táº¡i`; });
    if (!row.errors.class_id && row.classId !== null && !classIdsInDb.has(row.classId)) row.errors.class_id = 'Lá»›p khÃ´ng tá»“n táº¡i';
  });
  return { rows: rows.map(row => copyRowError(row.draft?.draftKey || '', row.errors)) };
};

const assertCopyDraftUnique = async (client, drafts) => {
  const fields = ['code', 'username', 'email'];
  for (const field of fields) {
    const values = drafts.map(draft => draft.values[field]);
    if (new Set(values).size !== values.length) {
      const error = new Error(`${field} bị trùng trong các bản sao`);
      error.code = 'COPY_DUPLICATE';
      throw error;
    }
  }
  const existing = await client.query(
    'SELECT code, username, email FROM tra_student WHERE code = ANY($1) OR username = ANY($2) OR email = ANY($3)',
    [drafts.map(draft => draft.values.code), drafts.map(draft => draft.values.username), drafts.map(draft => draft.values.email)]
  );
  if (existing.rows.length) {
    const error = new Error('Code, username hoặc email đã tồn tại');
    error.code = 'COPY_DUPLICATE';
    throw error;
  }
};

const commitCopyDrafts = async (drafts, attachmentUrls = new Map()) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await assertCopyDraftUnique(client, drafts);
    const created = [];
    for (const draft of drafts) {
      const sourceResult = await client.query(
        'SELECT password, attachment FROM tra_student WHERE id = $1 AND deleted_at IS NULL FOR SHARE',
        [draft.sourceId]
      );
      if (!sourceResult.rows.length) {
        const error = new Error(`Không tìm thấy sinh viên gốc ${draft.sourceId}`);
        error.code = 'COPY_SOURCE_NOT_FOUND';
        throw error;
      }
      const values = draft.values;
      const source = sourceResult.rows[0];
      const result = await client.query(`
        INSERT INTO tra_student
          (code, fullname, dob, sex, homecity, address, hair_color, email, facebook,
           class_id, username, password, description, hobbies, attachment, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
        RETURNING ${DEFAULT_SELECT}
      `, [
        values.code, values.fullname, values.dob || null, values.sex ?? null,
        values.homecity || null, values.address || null, values.hair_color || null,
        values.email, values.facebook || null, values.class_id || null, values.username,
        source.password, values.description || null, values.hobbies ?? 0,
        attachmentUrls.get(draft.draftKey) ?? source.attachment ?? null,
      ]);
      created.push({ draftKey: draft.draftKey, record: result.rows[0] });
    }
    await client.query('COMMIT');
    return { created };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Commit rechecks the database inside the transaction, but performs source
// locking and insertion in batches rather than once per draft.
const commitCopyDraftsBatch = async (drafts, attachmentUrls = new Map()) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await assertCopyDraftUnique(client, drafts);
    const sourceIds = [...new Set(drafts.map(draft => draft.sourceId))];
    const sourceResult = await client.query(
      'SELECT id, password, attachment FROM tra_student WHERE id = ANY($1::int[]) AND deleted_at IS NULL FOR SHARE',
      [sourceIds]
    );
    const sources = new Map(sourceResult.rows.map(source => [Number(source.id), source]));
    const missingSource = sourceIds.find(id => !sources.has(Number(id)));
    if (missingSource) {
      const error = new Error(`Source student ${missingSource} was not found`);
      error.code = 'COPY_SOURCE_NOT_FOUND';
      throw error;
    }
    const result = await client.query(`
      INSERT INTO tra_student
        (code, fullname, dob, sex, homecity, address, hair_color, email, facebook,
         class_id, username, password, description, hobbies, attachment, created_at, updated_at)
      SELECT input.*, NOW(), NOW() FROM UNNEST(
        $1::text[], $2::text[], $3::date[], $4::boolean[], $5::text[], $6::text[], $7::text[],
        $8::text[], $9::text[], $10::int[], $11::text[], $12::text[], $13::text[], $14::int[], $15::text[]
      ) AS input(code, fullname, dob, sex, homecity, address, hair_color, email, facebook,
        class_id, username, password, description, hobbies, attachment)
      RETURNING ${DEFAULT_SELECT}
    `, [
      drafts.map(draft => draft.values.code), drafts.map(draft => draft.values.fullname), drafts.map(draft => draft.values.dob || null),
      drafts.map(draft => draft.values.sex ?? null), drafts.map(draft => draft.values.homecity || null), drafts.map(draft => draft.values.address || null),
      drafts.map(draft => draft.values.hair_color || null), drafts.map(draft => draft.values.email), drafts.map(draft => draft.values.facebook || null),
      drafts.map(draft => draft.values.class_id || null), drafts.map(draft => draft.values.username),
      drafts.map(draft => sources.get(Number(draft.sourceId)).password), drafts.map(draft => draft.values.description || null),
      drafts.map(draft => draft.values.hobbies ?? 0), drafts.map(draft => attachmentUrls.get(draft.draftKey) ?? sources.get(Number(draft.sourceId)).attachment ?? null),
    ]);
    const createdByCode = new Map(result.rows.map(record => [record.code, record]));
    await client.query('COMMIT');
    return { created: drafts.map(draft => ({ draftKey: draft.draftKey, record: createdByCode.get(draft.values.code) })) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};


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

  getAll, getByPage, getDeletedByPage, store, update, destroy,massDestroy,
  restoreDeleted, permanentlyDelete,
  getActiveHobbyMask,
  uploadAttachment, deleteAttachment, getAttachmentById,
  copyOne, massCopy, getCopyPreview, validateCopyDrafts, commitCopyDrafts: commitCopyDraftsBatch, getManyByIds, getOneById,
};
