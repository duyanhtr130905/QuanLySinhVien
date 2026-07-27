const createErrorConfig = (statusCode, errorCode, message) => Object.freeze({ statusCode, errorCode, message });

const classErrors = Object.freeze({
  getByPage: Object.freeze({
    invalidPage: createErrorConfig(400, 'C601', 'Số trang không hợp lệ'),
    invalidSize: createErrorConfig(400, 'C602', 'Cỡ trang không hợp lệ'),
  }),
  store: Object.freeze({
    required: createErrorConfig(400, 'E603', 'code và name là bắt buộc'),
    codeTooLong: createErrorConfig(400, 'E603', 'code không được vượt quá 50 ký tự'),
    nameTooLong: createErrorConfig(400, 'E603', 'name không được vượt quá 255 ký tự'),
    duplicate: createErrorConfig(409, 'E603', 'Mã lớp (code) đã tồn tại'),
  }),
  update: Object.freeze({
    invalidId: createErrorConfig(400, 'F601', 'id không hợp lệ'),
    codeTooLong: createErrorConfig(400, 'F603', 'code không được vượt quá 50 ký tự'),
    nameTooLong: createErrorConfig(400, 'F603', 'name không được vượt quá 255 ký tự'),
    nameBlank: createErrorConfig(400, 'F603', 'name không được để trống'),
    notFound: createErrorConfig(404, 'F604', 'Không tìm thấy bản ghi lớp học'),
    duplicate: createErrorConfig(409, 'F603', 'Mã lớp (code) đã được sử dụng bởi bản ghi khác'),
  }),
  destroy: Object.freeze({
    invalidId: createErrorConfig(400, 'G601', 'id không hợp lệ'),
    notFound: createErrorConfig(404, 'G604', 'Không tìm thấy bản ghi lớp học'),
    foreignKeyBlocked: createErrorConfig(409, 'G605', 'Không thể xóa: Lớp học này vẫn còn sinh viên liên kết'),
  }),
  massDelete: Object.freeze({
    invalidIds: createErrorConfig(400, 'I604', 'Danh sách ids không hợp lệ'),
  }),
  copyOne: Object.freeze({
    invalidId: createErrorConfig(400, 'H601', 'id không hợp lệ'),
    notFound: createErrorConfig(404, 'H604', 'Không tìm thấy bản ghi lớp học gốc'),
  }),
  massCopy: Object.freeze({
    invalidIdList: createErrorConfig(400, 'H603', 'idlist không hợp lệ hoặc rỗng'),
    notFound: createErrorConfig(404, 'H604', 'Không tìm thấy các lớp gốc'),
  }),
});

module.exports = classErrors;
