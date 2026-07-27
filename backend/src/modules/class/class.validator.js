const AppError = require('../../core/http/AppError');
const {
  parseRequiredPositiveId,
  parsePaginationQuery,
  parseIdList,
} = require('../../core/http/requestParsers');
const errors = require('./class.errors');

const fail = (errorConfig) => {
  throw new AppError(errorConfig);
};

const parseLegacyId = (value, errorConfig) => parseRequiredPositiveId(value, {
  ...errorConfig,
  legacyParseInt: true,
});

const parseClassPageQuery = (query) => parsePaginationQuery(query, {
  legacyParseInt: true,
  pageError: errors.getByPage.invalidPage,
  sizeError: errors.getByPage.invalidSize,
  toplistOptions: { legacyParseInt: true, invalid: 'omit' },
});

const parseMassDeleteIds = (ids) => parseIdList(ids, {
  validate: false,
  errorConfig: errors.massDelete.invalidIds,
});

const parseMassCopyIdList = (idlist) => parseIdList(idlist, {
  validate: false,
  errorConfig: errors.massCopy.invalidIdList,
});

const validateStore = (body) => {
  const { code, name, description } = body;
  if (!code || !name) fail(errors.store.required);
  if (code.length > 50) fail(errors.store.codeTooLong);
  if (name.length > 255) fail(errors.store.nameTooLong);
  return { code, name, description };
};

const validateUpdate = (body) => {
  const { code, name, description } = body;
  if (code !== undefined && code.length > 50) fail(errors.update.codeTooLong);
  if (name !== undefined && name.length > 255) fail(errors.update.nameTooLong);
  if (name !== undefined && name.trim() === '') fail(errors.update.nameBlank);
  return { code, name, description };
};

module.exports = {
  parseGetByPage: parseClassPageQuery,
  parseUpdateId: (value) => parseLegacyId(value, errors.update.invalidId),
  parseDestroyId: (value) => parseLegacyId(value, errors.destroy.invalidId),
  parseCopyOneId: (value) => parseLegacyId(value, errors.copyOne.invalidId),
  parseMassDeleteIds,
  parseMassCopyIdList,
  validateStore,
  validateUpdate,
};
