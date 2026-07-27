const createErrorConfig = (statusCode, errorCode, message) => Object.freeze({ statusCode, errorCode, message });

const uniqueMessageForConstraint = (constraintName) => ({
  tra_hobby_name_key: 'Tên sở thích đã tồn tại',
  tra_hobby_code_key: 'Mã sở thích đã tồn tại',
  tra_hobby_bit_value_key: 'Xung đột dữ liệu nội bộ (bit_value trùng), vui lòng thử lại',
}[constraintName] || 'Dữ liệu đã tồn tại (vi phạm ràng buộc UNIQUE)');

const hobbyErrors = Object.freeze({
  store: Object.freeze({
    invalidName: createErrorConfig(400, 'E603', 'name là bắt buộc và không được để trống'),
    nameTooLong: createErrorConfig(400, 'E603', 'name không được vượt quá 30 ký tự'),
    bitExhausted: createErrorConfig(422, 'E604', ''),
    duplicate: createErrorConfig(409, 'E603', ''),
  }),
  destroy: Object.freeze({
    invalidId: createErrorConfig(400, 'G601', 'id không hợp lệ'),
    notFound: createErrorConfig(404, 'G604', 'Không tìm thấy hobby'),
    inUse: createErrorConfig(409, 'G605', 'Không thể xóa: sở thích này đang được sinh viên sử dụng'),
  }),
  uniqueMessageForConstraint,
});

module.exports = hobbyErrors;
