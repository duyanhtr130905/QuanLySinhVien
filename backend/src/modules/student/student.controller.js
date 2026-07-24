const studentService = require('./student.service');
const { successResponse, errorResponse } = require('../../utils/response');
const { parseFile, buildFile } = require('../../utils/fileFormat');

// ============================================================
// HELPERS VALIDATE
// ============================================================

const REGEX_EMAIL = /^[0-9a-zA-Z.\-_]+@[0-9a-zA-Z.\-_]+$/;
const REGEX_FACEBOOK = /^https?:\/\/[0-9a-zA-Z.\-_]+$/;
const REGEX_PASSWORD = /^(?=.*[0-9])(?=.*[A-Z])(?=.*[a-z])(?=.*[^A-Za-z0-9\s]).{8,}$/;

/**
 * Validate các field của student, trả về message lỗi đầu tiên tìm thấy.
 * Dùng chung cho store (strict) và update (partial — chỉ validate field có mặt).
 *
 * @param {object} body
 * @param {boolean} isCreate - true: tất cả field bắt buộc đều phải có; false: chỉ check field có mặt
 * @returns {string|null} - message lỗi hoặc null nếu hợp lệ
 */
const validate = (body, isCreate, activeMask) => {
  const { code, fullname, email, username, password, homecity, address, hair_color, facebook, hobbies } = body;

  // === Bắt buộc khi tạo mới ===
  if (isCreate) {
    if (!code || code.trim() === '') return 'code là bắt buộc';
    if (!fullname || fullname.trim() === '') return 'fullname là bắt buộc';
    if (!email || email.trim() === '') return 'email là bắt buộc';
    if (!username || username.trim() === '') return 'username là bắt buộc';
    if (!password || password.trim() === '') return 'password là bắt buộc';
  }

  // === Kiểm tra độ dài & format nếu field có mặt ===
  if (code !== undefined && code.length > 50) return 'code không được vượt quá 50 ký tự';
  if (username !== undefined && username.length > 50) return 'username không được vượt quá 50 ký tự';

  if (fullname !== undefined) {
    if (fullname.trim() === '') return 'fullname không được để trống';
    if (fullname.length > 30) return 'fullname không được vượt quá 30 ký tự';
  }

  if (homecity !== undefined && homecity.length > 100)
    return 'homecity không được vượt quá 100 ký tự';
  if (address !== undefined && address.length > 100)
    return 'address không được vượt quá 100 ký tự';
  if (hair_color !== undefined && hair_color.length > 7)
    return 'hair_color không được vượt quá 7 ký tự';

  if (email !== undefined) {
    if (email.length > 256) return 'email không được vượt quá 256 ký tự';
    if (!REGEX_EMAIL.test(email)) return 'email không đúng định dạng';
  }

  // facebook là optional — chỉ validate nếu có giá trị thực sự
  if (facebook !== undefined && facebook !== null && facebook !== '') {
    if (facebook.length > 256) return 'facebook không được vượt quá 256 ký tự';
    if (!REGEX_FACEBOOK.test(facebook)) return 'facebook phải là URL hợp lệ (http/https)';
  }

  if (password !== undefined) {
    if (!REGEX_PASSWORD.test(password))
      return 'password phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt';
  }

  // Validate hobbies (bitmask): phải là tập con của các bit hobby đang active
  if (hobbies !== undefined && hobbies !== null) {
    if (!Number.isInteger(hobbies) || hobbies < 0)
      return 'hobbies phải là số nguyên không âm';
    // Kiểm tra tập con: nếu bất kỳ bit nào trong hobbies không có trong activeMask
    if (activeMask !== undefined && (hobbies & ~activeMask) !== 0)
      return 'hobbies chứa giá trị không hợp lệ (bit hobby không tồn tại hoặc đã inactive)';
  }

  return null;
};

/**
 * Map constraint name của Postgres 23505 (UNIQUE violation) sang message rõ ràng.
 * Nếu không nhận ra constraint name thì trả generic.
 */
const mapUniqueConstraint = (constraintName) => {
  const map = {
    tra_student_code_key: 'Mã sinh viên (code) đã tồn tại',
    tra_student_email_key: 'Email đã tồn tại',
    tra_student_username_key: 'Username đã tồn tại',
  };
  return map[constraintName] || 'Dữ liệu đã tồn tại (vi phạm ràng buộc UNIQUE)';
};

/**
 * Parse lại các field từ multipart/form-data về đúng kiểu.
 * Chỉ ép kiểu nếu field THỰC SỰ là string (từ multipart).
 * Nếu field đã là đúng kiểu (từ JSON) thì giữ nguyên, không đụng vào.
 */
const parseMultipartBody = (body) => {
  const parsed = { ...body };

  // sex: chỉ ép kiểu nếu là string (từ multipart); nếu đã là boolean (từ JSON) thì giữ nguyên
  if (typeof parsed.sex === 'string') {
    if (parsed.sex === 'true') parsed.sex = true;
    else if (parsed.sex === 'false') parsed.sex = false;
    else parsed.sex = null;
  }
  // Nếu parsed.sex đã là boolean hoặc undefined/null -> giữ nguyên, không đụng vào

  // class_id: chỉ ép kiểu nếu là string; nếu đã là number/null (từ JSON) thì giữ nguyên
  if (typeof parsed.class_id === 'string') {
    const cid = parseInt(parsed.class_id, 10);
    parsed.class_id = (parsed.class_id === '' || parsed.class_id === '-1' || isNaN(cid)) ? null : cid;
  }

  // hobbies: chỉ ép kiểu nếu là string; nếu đã là number (từ JSON) thì giữ nguyên
  if (typeof parsed.hobbies === 'string') {
    const hv = parseInt(parsed.hobbies, 10);
    parsed.hobbies = (parsed.hobbies === '' || isNaN(hv)) ? 0 : hv;
  }

  return parsed;
};

// ============================================================
// 1. GET ALL
// GET /student
// ============================================================
const getAll = async (req, res, next) => {
  try {
    const { columnlist } = req.query;
    const data = await studentService.getAll(columnlist);
    return successResponse(res, data, 'Lấy danh sách sinh viên thành công');
  } catch (err) {
    err.fallbackCode = 'B600';
    next(err);
  }
};

// ============================================================
// 2. GET BY PAGE
// GET /student/page/:init?
// ============================================================
const getByPage = async (req, res, next) => {
  try {
    const { page, size, order, search, columnlist, toplist } = req.query;

    // Validate page
    const pageNum = parseInt(page, 10);
    if (!page || isNaN(pageNum) || pageNum < 1)
      return errorResponse(res, 400, 'C601', 'Số trang không hợp lệ');

    // Validate size
    const sizeNum = parseInt(size, 10);
    if (!size || isNaN(sizeNum) || sizeNum < 1)
      return errorResponse(res, 400, 'C602', 'Cỡ trang không hợp lệ');

    // Parse toplist: "1,2,3" -> [1, 2, 3]
    const toplistArr = toplist
      ? toplist.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id))
      : [];

    const data = await studentService.getByPage({
      page: pageNum, size: sizeNum, order, search, columnlist, toplist: toplistArr,
    });

    return successResponse(res, data, 'Lấy danh sách sinh viên theo trang thành công');
  } catch (err) {
    err.fallbackCode = 'C600';
    next(err);
  }
};

// ============================================================
// 3. STORE (Tạo mới)
// POST /student
// ============================================================
const store = async (req, res, next) => {
  // Khai báo ngoài try để catch có thể truy cập để dọn rác Storage nếu DB lỗi
  let attachmentUrl = null;

  try {
    // Parse lại các field string từ multipart/form-data về đúng kiểu
    const body = parseMultipartBody(req.body);

    // Lấy active hobby mask để validate hobbies
    const activeMask = await studentService.getActiveHobbyMask();

    // Validate (strict — isCreate = true)
    const errMsg = validate(body, true, activeMask);
    if (errMsg) return errorResponse(res, 400, 'E603', errMsg);

    // Xử lý file ảnh (nếu có)
    if (req.file) {
      // Upload lên Supabase Storage, lấy public URL
      attachmentUrl = await studentService.uploadAttachment(req.file, body.code);
    }

    const data = await studentService.store({ ...body, attachment: attachmentUrl });
    return successResponse(res, data, 'Tạo sinh viên thành công');
  } catch (err) {
    // Nếu đã upload ảnh thành công nhưng DB insert lỗi -> xóa ảnh rác vừa upload
    // .catch(() => {}) để lỗi xóa ảnh (nếu có) không che mất lỗi gốc từ DB
    if (attachmentUrl) {
      await studentService.deleteAttachment(attachmentUrl).catch(() => {});
    }

    // 23505: vi phạm UNIQUE (code/email/username trùng)
    if (err.code === '23505')
      return errorResponse(res, 409, 'E603', mapUniqueConstraint(err.constraint));
    // 23503: FK class_id không tồn tại trong tra_class
    if (err.code === '23503')
      return errorResponse(res, 400, 'E603', 'class_id không tồn tại');
    err.fallbackCode = 'E600';
    next(err);
  }
};

// ============================================================
// 4. UPDATE
// PUT /student/:id
// ============================================================
const update = async (req, res, next) => {
  // Khai báo ngoài try để catch có thể truy cập để dọn rác Storage nếu DB lỗi
  let newAttachmentUrl = undefined; // undefined = giữ nguyên attachment cũ trong DB

  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return errorResponse(res, 400, 'F601', 'id không hợp lệ');
    }

    // Parse lại các field string từ multipart/form-data về đúng kiểu
    const body = parseMultipartBody(req.body);

    // Lấy active hobby mask để validate hobbies
    const activeMask = await studentService.getActiveHobbyMask();

    // Validate (partial — isCreate = false, chỉ check field có mặt trong body)
    const errMsg = validate(body, false, activeMask);
    if (errMsg) return errorResponse(res, 400, 'F603', errMsg);

    let oldAttachmentUrl = null;

    if (req.file) {
      // Lấy attachment cũ TRƯỚC khi upload/update — cần để xóa sau khi DB update thành công
      oldAttachmentUrl = await studentService.getAttachmentById(id);

      // Upload ảnh mới TRƯỚC — nếu upload lỗi thì dừng luôn, không chạm vào DB
      newAttachmentUrl = await studentService.uploadAttachment(req.file, `id${id}`);
    }

    // Gán attachment mới vào body nếu có file mới
    const updateBody = newAttachmentUrl !== undefined
      ? { ...body, attachment: newAttachmentUrl }
      : body;

    const data = await studentService.update(id, updateBody);

    // null -> bản ghi không tồn tại hoặc đã bị soft-delete
    if (!data) {
      // Upload đã xảy ra nhưng DB không tìm thấy record -> xóa ảnh mới vừa upload để tránh rác
      if (newAttachmentUrl) await studentService.deleteAttachment(newAttachmentUrl);
      return errorResponse(res, 404, 'F604', 'Không tìm thấy sinh viên');
    }

    // Update DB thành công -> xóa ảnh CŨ khỏi Storage (nếu có ảnh mới)
    // Thứ tự đúng: upload mới -> update DB thành công -> xóa cũ (không mất ảnh nếu DB lỗi)
    if (newAttachmentUrl && oldAttachmentUrl && oldAttachmentUrl !== newAttachmentUrl) {
      await studentService.deleteAttachment(oldAttachmentUrl);
    }

    return successResponse(res, data, 'Cập nhật sinh viên thành công');
  } catch (err) {
    // Nếu đã upload ảnh MỚI thành công nhưng DB update lỗi -> xóa ảnh mới vừa upload (rác)
    // KHÔNG đụng vào ảnh cũ (oldAttachmentUrl) vì DB chưa hề đổi, ảnh cũ vẫn đúng là ảnh đang dùng
    if (newAttachmentUrl) {
      await studentService.deleteAttachment(newAttachmentUrl).catch(() => {});
    }

    // 23505: trùng email khi update
    if (err.code === '23505')
      return errorResponse(res, 409, 'F603', mapUniqueConstraint(err.constraint));
    // 23503: class_id mới không tồn tại
    if (err.code === '23503')
      return errorResponse(res, 400, 'F603', 'class_id không tồn tại');
    err.fallbackCode = 'F600';
    next(err);
  }
};

// ============================================================
// 5. DESTROY (Soft-delete qua trigger DB)
// DELETE /student/:id
// ============================================================
const destroy = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return errorResponse(res, 400, 'G601', 'id không hợp lệ');
    }
    const data = await studentService.destroy(id);

    // null -> không tìm thấy bản ghi (không tồn tại hoặc đã soft-delete rồi)
    if (!data) return errorResponse(res, 404, 'G604', 'Không tìm thấy sinh viên');

    return successResponse(res, data, 'Xóa sinh viên thành công');
  } catch (err) {
    err.fallbackCode = 'G600';
    next(err);
  }
};

// ============================================================
// 5b. MASS DESTROY (Xóa nhiều, soft-delete qua trigger DB)
// DELETE /student
// ============================================================
const massDestroy = async (req, res, next) => {
  try {
    const { idlist } = req.body;

    if (!Array.isArray(idlist) || idlist.length === 0) {
      return errorResponse(res, 400, 'G603', 'idlist không hợp lệ hoặc rỗng');
    }

    const { deleted, notFound } = await studentService.massDestroy(idlist);

    if (notFound.length > 0 && deleted.length === 0) {
      return errorResponse(
        res, 404, 'G604',
        `Không tìm thấy các sinh viên (ids: ${notFound.join(', ')})`
      );
    }

    return successResponse(
      res,
      { deleted, notFound },
      notFound.length > 0
        ? `Đã xóa ${deleted.length} sinh viên. Không tìm thấy ids: ${notFound.join(', ')}`
        : `Xóa ${deleted.length} sinh viên thành công`
    );
  } catch (err) {
    err.fallbackCode = 'G600';
    next(err);
  }
};  

// ============================================================
// 6. COPY ONE
// POST /student/copy/:id
// ============================================================
const copyOne = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return errorResponse(res, 400, 'H601', 'id không hợp lệ');
    }
    const data = await studentService.copyOne(id);

    if (!data) {
      return errorResponse(res, 404, 'H604', 'Không tìm thấy sinh viên gốc');
    }

    return successResponse(res, data, 'Sao chép sinh viên thành công');
  } catch (err) {
    err.fallbackCode = 'H600';
    next(err);
  }
};

// ============================================================
// 7. MASS COPY
// POST /student/copy
// ============================================================
const massCopy = async (req, res, next) => {
  try {
    const { idlist } = req.body;

    if (!Array.isArray(idlist) || idlist.length === 0) {
      return errorResponse(res, 400, 'H603', 'idlist không hợp lệ hoặc rỗng');
    }

    const { created, notFound } = await studentService.massCopy(idlist);

    if (notFound.length > 0 && created.length === 0) {
      return errorResponse(
        res, 404, 'H604',
        `Không tìm thấy các sinh viên gốc (ids: ${notFound.join(', ')})`
      );
    }

    return successResponse(
      res,
      created,
      notFound.length > 0
        ? `Đã sao chép ${created.length} sinh viên. Không tìm thấy ids: ${notFound.join(', ')}`
        : `Sao chép ${created.length} sinh viên thành công`
    );
  } catch (err) {
    err.fallbackCode = 'H600';
    next(err);
  }
};

// ============================================================
// 8. IMPORT STUDENTS
// POST /student/import
// ============================================================
const importStudents = async (req, res, next) => {
  try {
    if (!req.file) {
      return errorResponse(res, 400, 'J604', 'Không tìm thấy file upload');
    }

    const ext = req.file.originalname.split('.').pop().toLowerCase();

    let rows;
    try {
      rows = await parseFile(req.file.buffer, ext);
    } catch (err) {
      if (err.message === 'UNSUPPORTED_FORMAT') {
        return errorResponse(res, 400, 'J601', 'Định dạng file không được hỗ trợ (chỉ csv/xlsx/json/xml)');
      }
      return errorResponse(res, 400, 'J604', 'Không đọc được dữ liệu từ file: ' + err.message);
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return errorResponse(res, 400, 'J604', 'File không có dữ liệu');
    }

    // Lấy active hobby mask 1 LẦN duy nhất trước vòng lặp (không gọi lại mỗi dòng — tốn query)
    const activeMask = await studentService.getActiveHobbyMask();

    const created = [];
    const failed = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Ép kiểu cho dữ liệu từ file (CSV/XLSX trả string cho số/boolean)
      // parseMultipartBody đã xử lý đúng cả string lẫn kiểu gốc
      const normalizedRow = parseMultipartBody(row);

      // Validate TRƯỚC khi insert — dùng lại đúng hàm validate() đã có,
      // isCreate = true (import luôn coi là tạo mới)
      const errMsg = validate(normalizedRow, true, activeMask);
      if (errMsg) {
        failed.push({ row: i + 2, reason: errMsg }); // dòng 1 = header
        continue; // bỏ qua dòng này, KHÔNG gọi store()
      }

      try {
        const result = await studentService.store(normalizedRow);
        created.push(result);
      } catch (err) {
        failed.push({
          row: i + 2,
          reason: err.code === '23505' ? 'Trùng code/email/username' : (err.message || 'Lỗi không xác định'),
        });
      }
    }

    return successResponse(
      res,
      { created, failed },
      `Import thành công ${created.length} dòng, lỗi ${failed.length} dòng`
    );
  } catch (err) {
    err.fallbackCode = 'J600';
    next(err);
  }
};

// ============================================================
// 9. EXPORT ONE
// GET /student/export/:id
// ============================================================
const VALID_EXPORT_FORMATS = ['csv', 'xlsx', 'json', 'xml'];

const exportOne = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const type = (req.query.type || 'xlsx').toLowerCase();

    if (!VALID_EXPORT_FORMATS.includes(type)) {
      return errorResponse(res, 400, 'K601', 'Định dạng export không hợp lệ (chỉ csv/xlsx/json/xml)');
    }

    const student = await studentService.getOneById(id);
    if (!student) {
      return errorResponse(res, 404, 'K604', 'Không tìm thấy sinh viên');
    }

    const { buffer, contentType, extension } = buildFile([student], type);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="student-${id}.${extension}"`);
    return res.send(buffer);
  } catch (err) {
    err.fallbackCode = 'K600';
    next(err);
  }
};

// ============================================================
// 10. MASS EXPORT
// POST /student/export
// ============================================================
const massExport = async (req, res, next) => {
  try {
    const { idlist, type: rawType } = req.body;
    const type = (rawType || 'xlsx').toLowerCase();

    if (!Array.isArray(idlist) || idlist.length === 0) {
      return errorResponse(res, 400, 'K601', 'idlist không hợp lệ hoặc rỗng');
    }
    if (!VALID_EXPORT_FORMATS.includes(type)) {
      return errorResponse(res, 400, 'K601', 'Định dạng export không hợp lệ (chỉ csv/xlsx/json/xml)');
    }

    const students = await studentService.getManyByIds(idlist);
    const { buffer, contentType, extension } = buildFile(students, type);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="students-export.${extension}"`);
    return res.send(buffer);
  } catch (err) {
    err.fallbackCode = 'K600';
    next(err);
  }
};
// ============================================================
// GET BY ID (Xem chi tiết 1 sinh viên)
// GET /student/:id
// ============================================================
const getById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return errorResponse(res, 400, 'D601', 'id không hợp lệ');
    }

    const data = await studentService.getOneById(id);

    if (!data) {
      return errorResponse(res, 404, 'D604', 'Không tìm thấy sinh viên');
    }

    return successResponse(res, data, 'Lấy chi tiết sinh viên thành công');
  } catch (err) {
    err.fallbackCode = 'D600';
    next(err);
  }
};


module.exports = {
  getAll, getByPage, getById, store, update, destroy, massDestroy,
  copyOne, massCopy, importStudents, exportOne, massExport,
};

