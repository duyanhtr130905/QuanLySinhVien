const classService = require('./class.service');
const { successResponse, errorResponse } = require('../../utils/response');

// ============================================================
// 1. GET ALL
// GET /class
// ============================================================
const getAll = async (req, res, next) => {
  try {
    const { columnlist } = req.query;
    const data = await classService.getAll(columnlist);
    return successResponse(res, data, 'Lấy danh sách lớp thành công');
  } catch (err) {
    // Gán fallback code để errorHandler biết prefix
    err.fallbackCode = 'B600';
    next(err);
  }
};

// ============================================================
// 2. GET BY PAGE
// GET /class/page/:init?
// ============================================================
const getByPage = async (req, res, next) => {
  try {
    const { page, size, order, search, columnlist, toplist } = req.query;

    // Validate page
    const pageNum = parseInt(page, 10);
    if (!page || isNaN(pageNum) || pageNum < 1) {
      return errorResponse(res, 400, 'C601', 'Số trang không hợp lệ');
    }

    // Validate size
    const sizeNum = parseInt(size, 10);
    if (!size || isNaN(sizeNum) || sizeNum < 1) {
      return errorResponse(res, 400, 'C602', 'Cỡ trang không hợp lệ');
    }

    // Xử lý toplist: "1,2,3" -> [1, 2, 3]
    const toplistArr = toplist
      ? toplist
          .split(',')
          .map((id) => parseInt(id.trim(), 10))
          .filter((id) => !isNaN(id))
      : [];

    const data = await classService.getByPage({
      page: pageNum,
      size: sizeNum,
      order,
      search,
      columnlist,
      toplist: toplistArr,
    });

    return successResponse(res, data, 'Lấy danh sách lớp theo trang thành công');
  } catch (err) {
    err.fallbackCode = 'C600';
    next(err);
  }
};

// ============================================================
// 3. STORE (Tạo mới)
// POST /class
// ============================================================
const store = async (req, res, next) => {
  try {
    const { code, name, description } = req.body;

    // Validate bắt buộc
    if (!code || !name) {
      return errorResponse(res, 400, 'E603', 'code và name là bắt buộc');
    }
    if (code.length > 50) {
      return errorResponse(res, 400, 'E603', 'code không được vượt quá 50 ký tự');
    }
    if (name.length > 255) {
      return errorResponse(res, 400, 'E603', 'name không được vượt quá 255 ký tự');
    }

    const data = await classService.store({ code, name, description });
    return successResponse(res, data, 'Tạo lớp thành công');
  } catch (err) {
    // Lỗi 23505: vi phạm UNIQUE constraint (code đã tồn tại)
    if (err.code === '23505') {
      return errorResponse(res, 409, 'E603', 'Mã lớp (code) đã tồn tại');
    }
    err.fallbackCode = 'E600';
    next(err);
  }
};

// ============================================================
// 4. UPDATE
// PUT /class/:id
// ============================================================
const update = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return errorResponse(res, 400, 'F601', 'id không hợp lệ');
    }
    const { code, name, description } = req.body;

    // Validate các field nếu có
    if (code !== undefined && code.length > 50) {
      return errorResponse(res, 400, 'F603', 'code không được vượt quá 50 ký tự');
    }
    if (name !== undefined && name.length > 255) {
      return errorResponse(res, 400, 'F603', 'name không được vượt quá 255 ký tự');
    }
    // Không cho phép name thành chuỗi rỗng
    if (name !== undefined && name.trim() === '') {
      return errorResponse(res, 400, 'F603', 'name không được để trống');
    }

    const data = await classService.update(id, { code, name, description });

    if (!data) {
      return errorResponse(res, 404, 'F604', 'Không tìm thấy bản ghi lớp học');
    }

    return successResponse(res, data, 'Cập nhật lớp thành công');
  } catch (err) {
    // Lỗi 23505: trùng code với bản ghi khác
    if (err.code === '23505') {
      return errorResponse(res, 409, 'F603', 'Mã lớp (code) đã được sử dụng bởi bản ghi khác');
    }
    err.fallbackCode = 'F600';
    next(err);
  }
};

// ============================================================
// 5. DESTROY (Xóa 1)
// DELETE /class/:id
// ============================================================
const destroy = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return errorResponse(res, 400, 'G601', 'id không hợp lệ');
    }

    // Kiểm tra bản ghi tồn tại trước khi xóa
    const exists = await classService.existsById(id);
    if (!exists) {
      return errorResponse(res, 404, 'G604', 'Không tìm thấy bản ghi lớp học');
    }

    const data = await classService.destroy(id);
    return successResponse(res, data, 'Xóa lớp thành công');
  } catch (err) {
    // Lỗi 23503: vi phạm FK — còn sinh viên (kể cả đã soft-delete) thuộc lớp này
    if (err.code === '23503') {
      return errorResponse(
        res,
        409,
        'G605',
        'Không thể xóa: Lớp học này vẫn còn sinh viên liên kết'
      );
    }
    err.fallbackCode = 'G600';
    next(err);
  }
};

// ============================================================
// 6. MASS DELETE (Xóa nhiều)
// DELETE /class/delete
// ============================================================
const massDelete = async (req, res, next) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return errorResponse(res, 400, 'I604', 'Danh sách ids không hợp lệ');
    }

    const { deletedIds, blockedIds } = await classService.massDelete(ids);

    // Nếu có lớp bị chặn, vẫn trả về success nhưng báo số lớp không xóa được
    if (blockedIds.length > 0) {
      return successResponse(
        res,
        { ids: deletedIds },
        `Đã xóa ${deletedIds.length} lớp. Không thể xóa ${blockedIds.length} lớp vì còn sinh viên liên kết (ids: ${blockedIds.join(', ')})`
      );
    }

    return successResponse(res, { ids: deletedIds }, 'Xóa các lớp thành công');
  } catch (err) {
    err.fallbackCode = 'I600';
    next(err);
  }
};

// ============================================================
// 7. COPY 1 LỚP
// POST /class/copy/:id
// ============================================================
const copyOne = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return errorResponse(res, 400, 'H601', 'id không hợp lệ');
    }
    const data = await classService.copyOne(id);

    if (!data) {
      return errorResponse(res, 404, 'H604', 'Không tìm thấy bản ghi lớp học gốc');
    }

    return successResponse(res, data, 'Sao chép lớp thành công');
  } catch (err) {
    err.fallbackCode = 'H600';
    next(err);
  }
};

// ============================================================
// 8. MASS COPY (Sao chép nhiều lớp)
// POST /class/copy
// ============================================================
const massCopy = async (req, res, next) => {
  try {
    const { idlist } = req.body;

    if (!Array.isArray(idlist) || idlist.length === 0) {
      return errorResponse(res, 400, 'H603', 'idlist không hợp lệ hoặc rỗng');
    }

    const { created, notFound } = await classService.massCopy(idlist);

    if (notFound.length > 0 && created.length === 0) {
      // Không tìm thấy bất kỳ bản ghi gốc nào
      return errorResponse(
        res,
        404,
        'H604',
        `Không tìm thấy các lớp gốc (ids: ${notFound.join(', ')})`
      );
    }

    return successResponse(
      res,
      created,
      notFound.length > 0
        ? `Đã sao chép ${created.length} lớp. Không tìm thấy ids: ${notFound.join(', ')}`
        : `Sao chép ${created.length} lớp thành công`
    );
  } catch (err) {
    err.fallbackCode = 'H600';
    next(err);
  }
};

module.exports = {
  getAll,
  getByPage,
  store,
  update,
  destroy,
  massDelete,
  copyOne,
  massCopy,
};
