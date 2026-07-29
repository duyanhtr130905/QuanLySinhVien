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

const parseClassStudentsPageQuery = (query) => parsePaginationQuery(query, {
  legacyParseInt: true,
  pageError: errors.students.invalidPage,
  sizeError: errors.students.invalidSize,
});

const parseStudentIds = (studentIds) => [...new Set(parseIdList(studentIds, {
  errorConfig: errors.students.invalidStudentIds,
}))];

const parseExportIds = (idlist) => parseIdList(idlist, {
  errorConfig: errors.export.invalidIdList,
});

const isValidExportType = (value) => ['csv', 'xlsx', 'json', 'xml'].includes(value);

const validateStore = (body) => {
  const { code, name, description } = body;
  const normalizedCode = typeof code === 'string' ? code.trim() : code;
  const normalizedName = typeof name === 'string' ? name.trim() : name;
  if (!normalizedCode || !normalizedName) fail(errors.store.required);
  if (normalizedCode.length > 50) fail(errors.store.codeTooLong);
  if (normalizedName.length > 255) fail(errors.store.nameTooLong);
  return { code: normalizedCode, name: normalizedName, description };
};

const validateUpdate = (body) => {
  const { name, description } = body;
  if (name !== undefined && name.length > 255) fail(errors.update.nameTooLong);
  if (name !== undefined && name.trim() === '') fail(errors.update.nameBlank);
  return { code: undefined, name, description };
};

const validateImportRow = (row) => {
  const code = typeof row.code === 'string' ? row.code.trim() : row.code;
  const name = typeof row.name === 'string' ? row.name.trim() : row.name;
  const description = row.description;
  if (!code || !name) return { error: errors.store.required.message };
  if (code.length > 50) return { error: errors.store.codeTooLong.message };
  if (name.length > 255) return { error: errors.store.nameTooLong.message };
  return { value: { code, name, description } };
};

module.exports = {
  parseGetByPage: parseClassPageQuery,
  parseUpdateId: (value) => parseLegacyId(value, errors.update.invalidId),
  parseGetById: (value) => parseLegacyId(value, errors.getById.invalidId),
  parseDestroyId: (value) => parseLegacyId(value, errors.destroy.invalidId),
  parseCopyOneId: (value) => parseLegacyId(value, errors.copyOne.invalidId),
  parseMassDeleteIds,
  parseMassCopyIdList,
  parseClassStudentsId: (value) => parseLegacyId(value, errors.students.invalidId),
  parseClassStudentId: (value) => parseLegacyId(value, errors.students.invalidId),
  parseClassStudentsPageQuery,
  parseStudentIds,
  parseExportId: (value) => parseLegacyId(value, errors.export.invalidId),
  parseExportIds,
  isValidExportType,
  validateStore,
  validateUpdate,
  validateImportRow,
};
