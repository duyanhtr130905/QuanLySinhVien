const createErrorConfig = (statusCode, errorCode, message) => Object.freeze({ statusCode, errorCode, message });

const classErrors = Object.freeze({
  getByPage: Object.freeze({
    invalidPage: createErrorConfig(400, 'C601', 'Số trang không hợp lệ'),
    invalidSize: createErrorConfig(400, 'C602', 'Cỡ trang không hợp lệ'),
  }),
  getById: Object.freeze({
    invalidId: createErrorConfig(400, 'D601', 'id kh\u00f4ng h\u1ee3p l\u1ec7'),
    notFound: createErrorConfig(404, 'D604', 'Kh\u00f4ng t\u00ecm th\u1ea5y b\u1ea3n ghi l\u1edbp h\u1ecdc'),
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
  students: Object.freeze({
    invalidId: createErrorConfig(400, 'L601', 'id kh\u00f4ng h\u1ee3p l\u1ec7'),
    invalidStudentIds: createErrorConfig(400, 'L603', 'studentIds kh\u00f4ng h\u1ee3p l\u1ec7 ho\u1eb7c r\u1ed7ng'),
    classNotFound: createErrorConfig(404, 'L604', 'Kh\u00f4ng t\u00ecm th\u1ea5y b\u1ea3n ghi l\u1edbp h\u1ecdc'),
    studentNotFound: createErrorConfig(404, 'L605', 'Kh\u00f4ng t\u00ecm th\u1ea5y sinh vi\u00ean'),
    studentDeleted: createErrorConfig(409, 'L606', 'Sinh vi\u00ean \u0111\u00e3 b\u1ecb x\u00f3a'),
    studentAlreadyAssigned: createErrorConfig(409, 'L607', 'Sinh vi\u00ean \u0111\u00e3 thu\u1ed9c m\u1ed9t l\u1edbp'),
    studentNotInClass: createErrorConfig(409, 'L608', 'Sinh vi\u00ean kh\u00f4ng thu\u1ed9c l\u1edbp n\u00e0y'),
    invalidPage: createErrorConfig(400, 'L609', 'S\u1ed1 trang kh\u00f4ng h\u1ee3p l\u1ec7'),
    invalidSize: createErrorConfig(400, 'L610', 'C\u1ee1 trang kh\u00f4ng h\u1ee3p l\u1ec7'),
  }),
  import: Object.freeze({
    unsupportedFormat: createErrorConfig(400, 'J601', '\u0110\u1ecbnh d\u1ea1ng file kh\u00f4ng \u0111\u01b0\u1ee3c h\u1ed7 tr\u1ee3 (ch\u1ec9 csv/xlsx/json/xml)'),
    invalidFile: createErrorConfig(400, 'J604', ''),
  }),
  export: Object.freeze({
    invalid: createErrorConfig(400, 'K601', '\u0110\u1ecbnh d\u1ea1ng export kh\u00f4ng h\u1ee3p l\u1ec7 (ch\u1ec9 csv/xlsx/json/xml)'),
    invalidId: createErrorConfig(400, 'K601', 'id kh\u00f4ng h\u1ee3p l\u1ec7'),
    invalidIdList: createErrorConfig(400, 'K601', 'idlist kh\u00f4ng h\u1ee3p l\u1ec7 ho\u1eb7c r\u1ed7ng'),
    notFound: createErrorConfig(404, 'K604', 'Kh\u00f4ng t\u00ecm th\u1ea5y b\u1ea3n ghi l\u1edbp h\u1ecdc'),
  }),
});

module.exports = classErrors;
