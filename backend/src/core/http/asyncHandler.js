/**
 * Adapt an async Express handler so rejected promises are delegated to Express.
 * The wrapper intentionally does not create a response or transform the error.
 *
 * @param {Function} handler Express-compatible async handler
 * @returns {Function} Express handler
 */
const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve()
    .then(() => handler(req, res, next))
    .catch((error) => next(error));

module.exports = asyncHandler;
