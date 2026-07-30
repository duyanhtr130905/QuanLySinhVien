const createErrorConfig = (statusCode, errorCode, message) => Object.freeze({ statusCode, errorCode, message });

const uniqueMessageForConstraint = (constraintName) => ({
  tra_student_code_key: 'Mã sinh viên (code) đã tồn tại',
  tra_student_email_key: 'Email đã tồn tại',
  tra_student_username_key: 'Username đã tồn tại',
}[constraintName] || 'Dữ liệu đã tồn tại (vi phạm ràng buộc UNIQUE)');

const studentErrors = Object.freeze({
  getByPage: Object.freeze({
    invalidPage: createErrorConfig(400, 'C601', 'Số trang không hợp lệ'),
    invalidSize: createErrorConfig(400, 'C602', 'Cỡ trang không hợp lệ'),
  }),
  getById: Object.freeze({
    invalidId: createErrorConfig(400, 'D601', 'id không hợp lệ'),
    notFound: createErrorConfig(404, 'D604', 'Không tìm thấy sinh viên'),
  }),
  store: Object.freeze({
    validation: createErrorConfig(400, 'E603', ''),
    classNotFound: createErrorConfig(400, 'E603', 'class_id không tồn tại'),
    duplicate: createErrorConfig(409, 'E603', ''),
  }),
  update: Object.freeze({
    invalidId: createErrorConfig(400, 'F601', 'id không hợp lệ'),
    validation: createErrorConfig(400, 'F603', ''),
    classNotFound: createErrorConfig(400, 'F603', 'class_id không tồn tại'),
    duplicate: createErrorConfig(409, 'F603', ''),
    notFound: createErrorConfig(404, 'F604', 'Không tìm thấy sinh viên'),
  }),
  destroy: Object.freeze({
    invalidId: createErrorConfig(400, 'G601', 'id không hợp lệ'),
    invalidIdList: createErrorConfig(400, 'G603', 'idlist không hợp lệ hoặc rỗng'),
    notFound: createErrorConfig(404, 'G604', 'Không tìm thấy sinh viên'),
    massNotFound: createErrorConfig(404, 'G604', 'Không tìm thấy các sinh viên'),
  }),
  trash: Object.freeze({
    invalidIdList: createErrorConfig(400, 'L603', 'idlist kh\u00f4ng h\u1ee3p l\u1ec7 ho\u1eb7c r\u1ed7ng'),
  }),
  copy: Object.freeze({
    invalidId: createErrorConfig(400, 'H601', 'id không hợp lệ'),
    invalidIdList: createErrorConfig(400, 'H603', 'idlist không hợp lệ hoặc rỗng'),
    notFound: createErrorConfig(404, 'H604', 'Không tìm thấy sinh viên gốc'),
    massNotFound: createErrorConfig(404, 'H604', 'Không tìm thấy các sinh viên gốc'),
  }),
  import: Object.freeze({
    unsupportedFormat: createErrorConfig(400, 'J601', 'Định dạng file không được hỗ trợ (chỉ csv/xlsx/json/xml)'),
    invalidFile: createErrorConfig(400, 'J604', ''),
  }),
  export: Object.freeze({
    invalid: createErrorConfig(400, 'K601', 'Định dạng export không hợp lệ (chỉ csv/xlsx/json/xml)'),
    invalidIdList: createErrorConfig(400, 'K601', 'idlist không hợp lệ hoặc rỗng'),
    notFound: createErrorConfig(404, 'K604', 'Không tìm thấy sinh viên'),
  }),
  uniqueMessageForConstraint,
});

module.exports = studentErrors;
