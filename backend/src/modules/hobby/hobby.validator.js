const AppError = require('../../core/http/AppError');
const { parseRequiredPositiveId } = require('../../core/http/requestParsers');
const errors = require('./hobby.errors');

const fail = (errorConfig) => {
  throw new AppError(errorConfig);
};

const validateStore = (body) => {
  const { name } = body;
  if (!name || name.trim() === '') fail(errors.store.invalidName);
  if (name.trim().length > 30) fail(errors.store.nameTooLong);
  return name.trim();
};

const parseDestroyId = (value) => parseRequiredPositiveId(value, {
  ...errors.destroy.invalidId,
  legacyParseInt: true,
});

module.exports = { validateStore, parseDestroyId };
