class AppError extends Error {
  /**
   * @param {string|object} messageOrOptions Error message, or a complete options object.
   * @param {object} [options]
   * @param {number} [options.statusCode=500]
   * @param {string} [options.errorCode='600']
   * @param {unknown} [options.details]
   * @param {Error} [options.cause]
   */
  constructor(messageOrOptions = 'Lỗi hệ thống không xác định', options = {}) {
    const config = typeof messageOrOptions === 'object' && messageOrOptions !== null
      ? messageOrOptions
      : { ...options, message: messageOrOptions };
    const {
      message = 'Lỗi hệ thống không xác định',
      statusCode = 500,
      errorCode = '600',
      details,
      cause,
    } = config;

    super(message, cause === undefined ? undefined : { cause });
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.cause = cause;
  }
}

module.exports = AppError;
