const hobbyService = require('./hobby.service');
const { successResponse, errorResponse } = require('../../utils/response');

/**
 * Map constraint name của Postgres 23505 (UNIQUE violation) sang message rõ ràng.
 */
const mapHobbyUniqueConstraint = (constraintName) => {
  const map = {
    tra_hobby_name_key: 'Tên sở thích đã tồn tại',
    tra_hobby_code_key: 'Mã sở thích đã tồn tại',
    tra_hobby_bit_value_key: 'Xung đột dữ liệu nội bộ (bit_value trùng), vui lòng thử lại',
  };
  return map[constraintName] || 'Dữ liệu đã tồn tại (vi phạm ràng buộc UNIQUE)';
};

// ============================================================
// 1. GET ALL
// GET /hobby
// ============================================================
const getAll = async (req, res, next) => {
  try {
    const data = await hobbyService.getAll();
    return successResponse(res, data, 'Lấy danh sách sở thích thành công');
  } catch (err) {
    err.fallbackCode = 'B600';
    next(err);
  }
};

// ============================================================
// 2. STORE (Tạo mới)
// POST /hobby
// ============================================================
const store = async (req, res, next) => {
  try {
    const { name } = req.body;

    // Validate: name bắt buộc, không rỗng sau trim, tối đa 30 ký tự
    if (!name || name.trim() === '') {
      return errorResponse(res, 400, 'E603', 'name là bắt buộc và không được để trống');
    }
    if (name.trim().length > 30) {
      return errorResponse(res, 400, 'E603', 'name không được vượt quá 30 ký tự');
    }

    const data = await hobbyService.store(name.trim());
    return successResponse(res, data, 'Tạo sở thích thành công');
  } catch (err) {
    // Hết bit khả dụng (2^31 bit đã dùng hết — cực hiếm)
    if (err.isBitExhausted) {
      return errorResponse(res, 422, 'E604', err.message);
    }
    // Lỗi 23505: trùng name (race condition hoặc check DB trả về, phòng hờ)
    if (err.code === '23505') {
      return errorResponse(res, 409, 'E603', mapHobbyUniqueConstraint(err.constraint));
    }
    err.fallbackCode = 'E600';
    next(err);
  }
};

// ============================================================
// 3. DESTROY (Xóa 1)
// DELETE /hobby/:id
// ============================================================
const destroy = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return errorResponse(res, 400, 'G601', 'id không hợp lệ');
    }

    // Kiểm tra hobby có tồn tại không
    const hobby = await hobbyService.findById(id);
    if (!hobby) {
      return errorResponse(res, 404, 'G604', 'Không tìm thấy hobby');
    }

    // Kiểm tra bitwise: có sinh viên (chưa xóa mềm) nào đang dùng bit này không
    const inUse = await hobbyService.isUsedByStudent(hobby.bit_value);
    if (inUse) {
      return errorResponse(
        res,
        409,
        'G605',
        'Không thể xóa: sở thích này đang được sinh viên sử dụng'
      );
    }

    const data = await hobbyService.destroy(id);
    return successResponse(res, data, 'Xóa sở thích thành công');
  } catch (err) {
    err.fallbackCode = 'G600';
    next(err);
  }
};

module.exports = { getAll, store, destroy };
