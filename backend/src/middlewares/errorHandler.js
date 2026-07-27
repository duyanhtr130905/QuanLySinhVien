const { errorResponse } = require('../utils/response');

/**
 * Middleware bắt lỗi tập trung — đặt CUỐI CÙNG trong app.js.
 * Mọi lỗi từ controller/service được next(err) đến đây.
 *
 * Quy ước: nếu err có thuộc tính errorCode và statusCode (hoặc httpStatus legacy) thì dùng luôn,
 * ngược lại log ra và trả về lỗi 500 với code kết thúc bằng "600".
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Lỗi đã được xác định. Ưu tiên AppError.statusCode, vẫn hỗ trợ httpStatus legacy.
  const statusCode = err.statusCode || err.httpStatus;
  if (statusCode && err.errorCode) {
    return errorResponse(res, statusCode, err.errorCode, err.message);
  }

  // Lỗi không lường trước — log để debug
  console.error('❌ Lỗi không xác định:', err);

  // Cố lấy module error code từ request nếu controller đã gán
  const fallbackCode = err.fallbackCode || '600';
  return errorResponse(res, 500, fallbackCode, 'Lỗi hệ thống không xác định');
};

module.exports = errorHandler;
