/**
 * Helper tạo response chuẩn cho toàn bộ API.
 * Format: { code, status, message, data }
 */

/**
 * Trả về response thành công (HTTP 200).
 * @param {import('express').Response} res
 * @param {any} data - Payload trả về
 * @param {string} message - Mô tả ngắn
 */
const successResponse = (res, data, message = 'Thành công') => {
  return res.status(200).json({
    code: '200',
    status: 200,
    message,
    data,
  });
};

/**
 * Trả về response lỗi.
 * @param {import('express').Response} res
 * @param {number} httpStatus - HTTP status code (ví dụ: 400, 404, 500)
 * @param {string} errorCode - Mã lỗi module (ví dụ: 'E603', 'G604')
 * @param {string} message - Mô tả lỗi
 */
const errorResponse = (res, httpStatus, errorCode, message, data = null) => {
  return res.status(httpStatus).json({
    code: errorCode,
    status: httpStatus,
    message,
    data,
  });
};

module.exports = { successResponse, errorResponse };
