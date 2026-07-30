const pool = require('../../config/db');
const createListRepository = require('../../core/database/createListRepository');
const { generateUniqueValue, getCopyCandidateBatch, runMassCopyTransaction } = require('../../utils/copyHelpers');
const { resolveColumns, resolveOrderBy } = require('../../utils/queryHelpers');
const AppError = require('../../core/http/AppError');
const errors = require('./class.errors');

// ============================================================
// DANH SÁCH CỘT HỢP LỆ — dùng để validate columnlist
// ============================================================
const VALID_COLUMNS = ['id', 'code', 'name', 'description', 'created_at', 'updated_at'];
// Mapping alias ngắn (dùng trong param "order") -> tên cột thật
const COLUMN_ALIAS = {
  id: 'id',
  co: 'code',
  na: 'name',
  de: 'description',
  ca: 'created_at',
  ua: 'updated_at',
};

const listRepository = createListRepository({
  pool,
  tableName: 'tra_class',
  validColumns: VALID_COLUMNS,
  defaultColumns: VALID_COLUMNS,
  columnAliases: COLUMN_ALIAS,
  searchColumns: ['code', 'name', 'description'],
  defaultOrder: 'ORDER BY id ASC',
  additionalSelect: `,
    (SELECT COUNT(*)
     FROM tra_student student
     WHERE student.class_id = tra_class.id AND student.deleted_at IS NULL) AS student_count`,
});

const STUDENT_COLUMNS = [
  'id', 'code', 'fullname', 'dob', 'sex', 'homecity', 'address',
  'hair_color', 'email', 'facebook', 'class_id', 'username',
  'description', 'hobbies', 'attachment', 'created_at', 'updated_at',
];
const STUDENT_DEFAULT_SELECT = STUDENT_COLUMNS.join(', ');
const STUDENT_COLUMN_ALIAS = {
  id: 'id', co: 'code', fn: 'fullname', do: 'dob', sx: 'sex', hc: 'homecity',
  ad: 'address', hr: 'hair_color', em: 'email', fb: 'facebook', ci: 'class_id',
  un: 'username', de: 'description', ca: 'created_at', ua: 'updated_at',
};
const STUDENT_SEARCH_COLUMNS = ['code', 'fullname', 'email', 'username', 'description'];

const availableStudentsRepository = createListRepository({
  pool,
  tableName: 'tra_student',
  validColumns: STUDENT_COLUMNS,
  defaultColumns: STUDENT_COLUMNS,
  columnAliases: STUDENT_COLUMN_ALIAS,
  searchColumns: STUDENT_SEARCH_COLUMNS,
  baseWhereClause: 'class_id IS NULL',
  deletedFilter: 'deleted_at IS NULL',
  defaultOrder: 'ORDER BY id ASC',
});

// ============================================================
// 1. GET ALL
// ============================================================
/**
 * Lấy toàn bộ danh sách lớp, hỗ trợ lọc cột qua columnlist.
 */
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
  // Điều kiện tìm kiếm (ILIKE để không phân biệt hoa thường)
  // Đếm tổng số bản ghi thỏa điều kiện
  // Xây ORDER BY
  // Xử lý toplist: ghim các bản ghi có id thuộc toplist lên đầu
// ============================================================
// 3. STORE (Tạo mới)
// ============================================================
/**
 * Tạo mới một bản ghi lớp học.
 * @param {object} data - { code, name, description }
 * @returns {{ id: number }}
 */
const { getAll, getByPage } = listRepository;

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

const getOneById = async (id) => {
  const result = await pool.query(
    `SELECT id, code, name, description, created_at, updated_at,
      (SELECT COUNT(*) FROM tra_student student
       WHERE student.class_id = tra_class.id AND student.deleted_at IS NULL) AS student_count
     FROM tra_class
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const getStudentsByClass = async (classId, { page, size, order, search, columnlist }) => {
  const classExists = await existsById(classId);
  if (!classExists) return null;

  const columns = resolveColumns(STUDENT_COLUMNS, STUDENT_DEFAULT_SELECT, columnlist);
  const queryParams = [classId];
  const conditions = ['class_id = $1', 'deleted_at IS NULL'];

  if (search) {
    const parameter = `$${queryParams.length + 1}`;
    queryParams.push(`%${search}%`);
    conditions.push(`(${STUDENT_SEARCH_COLUMNS.map((column) => `${column} ILIKE ${parameter}`).join(' OR ')})`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const countResult = await pool.query(`SELECT COUNT(*) FROM tra_student ${whereClause}`, queryParams);
  const totalItems = parseInt(countResult.rows[0].count, 10);
  const totalPages = Math.ceil(totalItems / size);
  const orderBy = resolveOrderBy(STUDENT_COLUMN_ALIAS, order) || 'ORDER BY id ASC';

  const sizeParameter = `$${queryParams.length + 1}`;
  queryParams.push(size);
  const offsetParameter = `$${queryParams.length + 1}`;
  queryParams.push((page - 1) * size);
  const result = await pool.query(
    `SELECT ${columns} FROM tra_student ${whereClause}
     ${orderBy} LIMIT ${sizeParameter} OFFSET ${offsetParameter}`,
    queryParams
  );

  return {
    page_info: { total_items: totalItems, total_pages: totalPages, current: page, size },
    records: result.rows,
  };
};

const getAvailableStudentsByClass = async (classId, query) => {
  const classExists = await existsById(classId);
  if (!classExists) return null;
  return availableStudentsRepository.getByPage(query);
};

// pg may return integer columns as strings depending on the configured type parsers.
// Keep IDs comparable without coercing invalid input to NaN.
const normalizePositiveId = (value) => {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    const normalized = Number(value);
    return Number.isSafeInteger(normalized) ? normalized : null;
  }
  return null;
};

const normalizeRequiredId = (value, errorConfig) => {
  const normalized = normalizePositiveId(value);
  if (normalized === null) throw new AppError(errorConfig);
  return normalized;
};

const normalizeStudentIds = (studentIds) => {
  if (!Array.isArray(studentIds)) throw new AppError(errors.students.invalidStudentIds);
  const normalized = studentIds.map((id) => normalizePositiveId(id));
  const uniqueIds = [...new Set(normalized)];
  if (uniqueIds.length === 0 || normalized.some((id) => id === null)) {
    throw new AppError(errors.students.invalidStudentIds);
  }
  return uniqueIds;
};

const assignStudents = async (classId, studentIds) => {
  const normalizedClassId = normalizeRequiredId(classId, errors.students.invalidId);
  const normalizedStudentIds = normalizeStudentIds(studentIds);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const classResult = await client.query('SELECT id FROM tra_class WHERE id = $1 FOR UPDATE', [normalizedClassId]);
    if (classResult.rows.length === 0) throw new AppError(errors.students.classNotFound);

    const studentsResult = await client.query(
      'SELECT id, class_id, deleted_at FROM tra_student WHERE id = ANY($1::int[]) FOR UPDATE',
      [normalizedStudentIds]
    );
    const byId = new Map(studentsResult.rows.map((student) => [
      normalizeRequiredId(student.id, errors.students.invalidStudentIds),
      student,
    ]));
    const missingIds = normalizedStudentIds.filter((id) => !byId.has(id));
    if (missingIds.length) throw new AppError({ ...errors.students.studentNotFound, message: `${errors.students.studentNotFound.message}: ${missingIds.join(', ')}` });

    const deletedIds = normalizedStudentIds.filter((id) => byId.get(id).deleted_at !== null);
    if (deletedIds.length) throw new AppError({ ...errors.students.studentDeleted, message: `${errors.students.studentDeleted.message}: ${deletedIds.join(', ')}` });

    const assignedIds = normalizedStudentIds.filter((id) => byId.get(id).class_id !== null);
    if (assignedIds.length) throw new AppError({ ...errors.students.studentAlreadyAssigned, message: `${errors.students.studentAlreadyAssigned.message}: ${assignedIds.join(', ')}` });

    await client.query(
      'UPDATE tra_student SET class_id = $1, updated_at = NOW() WHERE id = ANY($2::int[]) AND class_id IS NULL AND deleted_at IS NULL',
      [normalizedClassId, normalizedStudentIds]
    );
    await client.query('COMMIT');
    return normalizedStudentIds;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const removeStudent = async (classId, studentId) => {
  const normalizedClassId = normalizeRequiredId(classId, errors.students.invalidId);
  const normalizedStudentId = normalizeRequiredId(studentId, errors.students.invalidId);
  const classExists = await existsById(normalizedClassId);
  if (!classExists) throw new AppError(errors.students.classNotFound);

  const studentResult = await pool.query(
    'SELECT id, class_id FROM tra_student WHERE id = $1 AND deleted_at IS NULL',
    [normalizedStudentId]
  );
  if (studentResult.rows.length === 0) throw new AppError(errors.students.studentNotFound);
  const studentClassId = studentResult.rows[0].class_id === null
    ? null
    : normalizePositiveId(studentResult.rows[0].class_id);
  if (studentClassId !== normalizedClassId) throw new AppError(errors.students.studentNotInClass);

  const result = await pool.query(
    'UPDATE tra_student SET class_id = NULL, updated_at = NOW() WHERE id = $1 AND class_id = $2 AND deleted_at IS NULL RETURNING id',
    [normalizedStudentId, normalizedClassId]
  );
  if (result.rows.length === 0) throw new AppError(errors.students.studentNotInClass);
  return { studentId: result.rows[0].id };
};

const removeStudents = async (classId, studentIds) => {
  const normalizedClassId = normalizeRequiredId(classId, errors.students.invalidId);
  const normalizedStudentIds = normalizeStudentIds(studentIds);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const classResult = await client.query('SELECT id FROM tra_class WHERE id = $1 FOR UPDATE', [normalizedClassId]);
    if (classResult.rows.length === 0) throw new AppError(errors.students.classNotFound);

    const studentsResult = await client.query(
      'SELECT id, class_id, deleted_at FROM tra_student WHERE id = ANY($1::int[]) FOR UPDATE',
      [normalizedStudentIds]
    );
    const studentsById = new Map(studentsResult.rows.map((student) => [
      normalizeRequiredId(student.id, errors.students.invalidStudentIds),
      student,
    ]));
    const missingIds = normalizedStudentIds.filter((id) => !studentsById.has(id));
    if (missingIds.length) throw new AppError({ ...errors.students.studentNotFound, message: `${errors.students.studentNotFound.message}: ${missingIds.join(', ')}` });

    const deletedIds = normalizedStudentIds.filter((id) => studentsById.get(id).deleted_at !== null);
    if (deletedIds.length) throw new AppError({ ...errors.students.studentDeleted, message: `${errors.students.studentDeleted.message}: ${deletedIds.join(', ')}` });

    const notInClassIds = normalizedStudentIds.filter((id) => (
      normalizePositiveId(studentsById.get(id).class_id) !== normalizedClassId
    ));
    if (notInClassIds.length) throw new AppError({ ...errors.students.studentNotInClass, message: `${errors.students.studentNotInClass.message}: ${notInClassIds.join(', ')}` });

    const result = await client.query(
      'UPDATE tra_student SET class_id = NULL, updated_at = NOW() WHERE id = ANY($1::int[]) AND class_id = $2 AND deleted_at IS NULL RETURNING id',
      [normalizedStudentIds, normalizedClassId]
    );
    if (result.rows.length !== normalizedStudentIds.length) throw new AppError(errors.students.studentNotInClass);
    await client.query('COMMIT');
    return normalizedStudentIds;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const getManyForExport = async (ids) => {
  const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
  const result = await pool.query(
    `SELECT code, name, description FROM tra_class WHERE id IN (${placeholders}) ORDER BY id ASC`,
    ids
  );
  return result.rows;
};

const getOneForExport = async (id) => {
  const result = await pool.query(
    'SELECT code, name, description FROM tra_class WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
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

const getCopyPreview = async (idlist) => {
  const ids = [...new Set(idlist)];
  const sourcesResult = await pool.query('SELECT id, code, name, description FROM tra_class WHERE id = ANY($1::int[])', [ids]);
  const sources = new Map(sourcesResult.rows.map(row => [Number(row.id), row]));
  const candidateCodes = new Set();
  sourcesResult.rows.forEach(source => getCopyCandidateBatch('code', source.code, 50).forEach(code => candidateCodes.add(code)));
  const existingResult = await pool.query('SELECT code FROM tra_class WHERE code = ANY($1::text[])', [[...candidateCodes]]);
  const occupied = new Set(existingResult.rows.map(row => row.code));
  const reserved = new Set();
  const drafts = [];
  const notFoundIds = [];
  ids.forEach((id) => {
    const source = sources.get(Number(id));
    if (!source) {
      notFoundIds.push(id);
      return;
    }
    const code = getCopyCandidateBatch('code', source.code, 50).find(candidate => !occupied.has(candidate) && !reserved.has(candidate));
    if (!code) {
      const error = new Error('KhÃ´ng thá»ƒ táº¡o mÃ£ lá»›p duy nháº¥t');
      error.code = 'COPY_DUPLICATE';
      throw error;
    }
    reserved.add(code);
    drafts.push({ draftKey: `class-${id}`, sourceId: id, values: { code, name: source.name, description: source.description || '' } });
  });
  return { drafts, notFoundIds };
};

const validateCopyDrafts = async (drafts) => {
  const rows = (Array.isArray(drafts) ? drafts : []).map((draft, index) => {
    const code = typeof draft?.values?.code === 'string' ? draft.values.code.trim() : '';
    const name = typeof draft?.values?.name === 'string' ? draft.values.name.trim() : '';
    const errors = {};
    if (!draft?.draftKey || typeof draft.draftKey !== 'string') errors.draftKey = `Draft ${index + 1} khÃ´ng há»£p lá»‡`;
    if (!Number.isSafeInteger(Number(draft?.sourceId)) || Number(draft.sourceId) <= 0) errors.sourceId = 'Báº£n ghi gá»‘c khÃ´ng há»£p lá»‡';
    if (!code) errors.code = 'MÃ£ lá»›p lÃ  báº¯t buá»™c'; else if (code.length > 50) errors.code = 'MÃ£ lá»›p khÃ´ng Ä‘Æ°á»£c vÆ°á»£t quÃ¡ 50 kÃ½ tá»±';
    if (!name) errors.name = 'TÃªn lá»›p lÃ  báº¯t buá»™c'; else if (name.length > 255) errors.name = 'TÃªn lá»›p khÃ´ng Ä‘Æ°á»£c vÆ°á»£t quÃ¡ 255 kÃ½ tá»±';
    return { draft, code, errors };
  });
  const counts = new Map();
  rows.forEach(row => { if (row.code) counts.set(row.code, (counts.get(row.code) || 0) + 1); });
  rows.forEach(row => { if (row.code && counts.get(row.code) > 1) row.errors.code = 'MÃ£ lá»›p bá»‹ trÃ¹ng trong cÃ¡c báº£n sao'; });
  const codes = [...new Set(rows.filter(row => !row.errors.code && row.code).map(row => row.code))];
  const existingResult = await pool.query('SELECT code FROM tra_class WHERE code = ANY($1::text[])', [codes]);
  const existingCodes = new Set(existingResult.rows.map(row => row.code));
  rows.forEach(row => { if (!row.errors.code && existingCodes.has(row.code)) row.errors.code = 'MÃ£ lá»›p Ä‘Ã£ tá»“n táº¡i'; });
  return { rows: rows.map(row => ({ draftKey: row.draft?.draftKey || '', status: Object.keys(row.errors).length ? 'invalid' : 'valid', errors: row.errors })) };
};

const commitCopyDrafts = async (drafts) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const codes = drafts.map(draft => draft.values.code);
    if (new Set(codes).size !== codes.length) {
      const error = new Error('Mã lớp bị trùng trong các bản sao');
      error.code = 'COPY_DUPLICATE';
      throw error;
    }
    const existing = await client.query('SELECT code FROM tra_class WHERE code = ANY($1)', [codes]);
    if (existing.rows.length) {
      const error = new Error('Mã lớp đã tồn tại');
      error.code = 'COPY_DUPLICATE';
      throw error;
    }
    const created = [];
    for (const draft of drafts) {
      const source = await client.query('SELECT id FROM tra_class WHERE id = $1 FOR SHARE', [draft.sourceId]);
      if (!source.rows.length) {
        const error = new Error(`Không tìm thấy lớp gốc ${draft.sourceId}`);
        error.code = 'COPY_SOURCE_NOT_FOUND';
        throw error;
      }
      const values = draft.values;
      const result = await client.query(
        'INSERT INTO tra_class (code, name, description, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *',
        [values.code, values.name, values.description || null]
      );
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

const commitCopyDraftsBatch = async (drafts) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const codes = drafts.map(draft => draft.values.code);
    if (new Set(codes).size !== codes.length) {
      const error = new Error('Duplicate class code in copy drafts');
      error.code = 'COPY_DUPLICATE';
      throw error;
    }
    const [existingResult, sourceResult] = await Promise.all([
      client.query('SELECT code FROM tra_class WHERE code = ANY($1::text[])', [codes]),
      client.query('SELECT id FROM tra_class WHERE id = ANY($1::int[]) FOR SHARE', [[...new Set(drafts.map(draft => draft.sourceId))]]),
    ]);
    if (existingResult.rows.length) {
      const error = new Error('Class code already exists');
      error.code = 'COPY_DUPLICATE';
      throw error;
    }
    const sourceIds = new Set(sourceResult.rows.map(row => Number(row.id)));
    const missingSource = drafts.map(draft => draft.sourceId).find(id => !sourceIds.has(Number(id)));
    if (missingSource) {
      const error = new Error(`Source class ${missingSource} was not found`);
      error.code = 'COPY_SOURCE_NOT_FOUND';
      throw error;
    }
    const result = await client.query(`
      INSERT INTO tra_class (code, name, description, created_at, updated_at)
      SELECT code, name, description, NOW(), NOW()
      FROM UNNEST($1::text[], $2::text[], $3::text[]) AS input(code, name, description)
      RETURNING *
    `, [codes, drafts.map(draft => draft.values.name), drafts.map(draft => draft.values.description || null)]);
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

module.exports = {
  getAll,
  getByPage,
  store,
  update,
  destroy,
  existsById,
  getOneById,
  getStudentsByClass,
  getAvailableStudentsByClass,
  assignStudents,
  removeStudent,
  removeStudents,
  massDelete,
  copyOne,
  massCopy,
  getCopyPreview,
  validateCopyDrafts,
  commitCopyDrafts: commitCopyDraftsBatch,
  getManyForExport,
  getOneForExport,
};
