const AppError = require('./AppError');

const DEFAULT_ID_ERROR = {
  statusCode: 400,
  errorCode: 'INVALID_ID',
  message: 'id không hợp lệ',
};

const DEFAULT_PAGE_ERROR = {
  statusCode: 400,
  errorCode: 'INVALID_PAGE',
  message: 'Số trang không hợp lệ',
};

const DEFAULT_SIZE_ERROR = {
  statusCode: 400,
  errorCode: 'INVALID_PAGE_SIZE',
  message: 'Cỡ trang không hợp lệ',
};

const DEFAULT_LIST_ERROR = {
  statusCode: 400,
  errorCode: 'INVALID_ID_LIST',
  message: 'Danh sách id không hợp lệ',
};

const toAppError = (config, fallback) => new AppError({ ...fallback, ...config });

/**
 * Parse one positive integer without accepting partial numeric strings by default.
 * `legacyParseInt: true` is available for endpoints whose old controller used parseInt.
 */
const parsePositiveId = (value, { legacyParseInt = false } = {}) => {
  if (legacyParseInt) {
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;

  const parsed = /^\d+$/.test(value) ? Number(value) : NaN;

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

/**
 * Parse one required positive id or throw an AppError built from errorConfig.
 */
const parseRequiredPositiveId = (value, errorConfig = {}) => {
  const { legacyParseInt = false, ...appErrorConfig } = errorConfig;
  const id = parsePositiveId(value, { legacyParseInt });
  if (id === null) throw toAppError(appErrorConfig, DEFAULT_ID_ERROR);
  return id;
};

/**
 * Parse common page query parameters. The returned object is a new object and
 * retains optional query fields required by the existing page services.
 */
const parsePaginationQuery = (query = {}, options = {}) => {
  const {
    pageKey = 'page',
    sizeKey = 'size',
    optionalKeys = ['order', 'search', 'columnlist'],
    toplistKey = 'toplist',
    pageError = DEFAULT_PAGE_ERROR,
    sizeError = DEFAULT_SIZE_ERROR,
    legacyParseInt = false,
    toplistOptions,
  } = options;

  const page = parsePositiveId(query[pageKey], { legacyParseInt });
  if (page === null) throw toAppError(pageError, DEFAULT_PAGE_ERROR);

  const size = parsePositiveId(query[sizeKey], { legacyParseInt });
  if (size === null) throw toAppError(sizeError, DEFAULT_SIZE_ERROR);

  const parsed = { page, size };
  for (const key of optionalKeys) parsed[key] = query[key];
  parsed.toplist = parseToplist(query[toplistKey], toplistOptions);
  return parsed;
};

/**
 * Parse an id list. Strict validation is the default; callers that need to
 * retain a legacy pass-through contract can set `validate: false` explicitly.
 */
const parseIdList = (value, options = {}) => {
  const {
    allowEmpty = false,
    validate = true,
    legacyParseInt = false,
    errorConfig = DEFAULT_LIST_ERROR,
  } = options;

  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw toAppError(errorConfig, DEFAULT_LIST_ERROR);
  }

  if (!validate) return [...value];

  const ids = value.map((item) => parsePositiveId(item, { legacyParseInt }));
  if (ids.some((id) => id === null)) throw toAppError(errorConfig, DEFAULT_LIST_ERROR);
  return ids;
};

/**
 * Parse a comma-separated toplist query value. Invalid entries throw by
 * default. Set `invalid: 'omit'` to match the legacy class/student behavior.
 */
const parseToplist = (value, options = {}) => {
  const {
    separator = ',',
    invalid = 'throw',
    legacyParseInt = false,
    errorConfig = DEFAULT_LIST_ERROR,
  } = options;

  if (value === undefined || value === null || value === '') return [];
  const entries = Array.isArray(value) ? [...value] : (typeof value === 'string' ? value.split(separator) : null);
  if (!entries) throw toAppError(errorConfig, DEFAULT_LIST_ERROR);

  const ids = [];
  for (const entry of entries) {
    const id = parsePositiveId(typeof entry === 'string' ? entry.trim() : entry, { legacyParseInt });
    if (id === null) {
      if (invalid === 'omit') continue;
      throw toAppError(errorConfig, DEFAULT_LIST_ERROR);
    }
    ids.push(id);
  }
  return ids;
};

module.exports = {
  parsePositiveId,
  parseRequiredPositiveId,
  parsePaginationQuery,
  parseIdList,
  parseToplist,
};
