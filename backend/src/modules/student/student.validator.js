const { parseRequiredPositiveId, parsePaginationQuery, parseIdList } = require('../../core/http/requestParsers');
const AppError = require('../../core/http/AppError');
const errors = require('./student.errors');

const REGEX_EMAIL = /^[0-9a-zA-Z.\-_]+@[0-9a-zA-Z.\-_]+$/;
const REGEX_FACEBOOK = /^https?:\/\/[0-9a-zA-Z.\-_]+$/;
const REGEX_PASSWORD = /^(?=.*[0-9])(?=.*[A-Z])(?=.*[a-z])(?=.*[^A-Za-z0-9\s]).{8,}$/;

const validateStudent = (body, isCreate, activeMask) => {
  const { code, fullname, email, username, password, homecity, address, hair_color, facebook, hobbies } = body;

  if (isCreate) {
    if (!code || code.trim() === '') return 'code là bắt buộc';
    if (!fullname || fullname.trim() === '') return 'fullname là bắt buộc';
    if (!email || email.trim() === '') return 'email là bắt buộc';
    if (!username || username.trim() === '') return 'username là bắt buộc';
    if (!password || password.trim() === '') return 'password là bắt buộc';
  }

  if (code !== undefined && code.length > 50) return 'code không được vượt quá 50 ký tự';
  if (username !== undefined && username.length > 50) return 'username không được vượt quá 50 ký tự';

  if (fullname !== undefined) {
    if (fullname.trim() === '') return 'fullname không được để trống';
    if (fullname.length > 30) return 'fullname không được vượt quá 30 ký tự';
  }

  if (homecity !== undefined && homecity.length > 100) return 'homecity không được vượt quá 100 ký tự';
  if (address !== undefined && address.length > 100) return 'address không được vượt quá 100 ký tự';
  if (hair_color !== undefined && hair_color.length > 7) return 'hair_color không được vượt quá 7 ký tự';

  if (email !== undefined) {
    if (email.length > 256) return 'email không được vượt quá 256 ký tự';
    if (!REGEX_EMAIL.test(email)) return 'email không đúng định dạng';
  }

  if (facebook !== undefined && facebook !== null && facebook !== '') {
    if (facebook.length > 256) return 'facebook không được vượt quá 256 ký tự';
    if (!REGEX_FACEBOOK.test(facebook)) return 'facebook phải là URL hợp lệ (http/https)';
  }

  if (password !== undefined && !REGEX_PASSWORD.test(password)) {
    return 'password phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt';
  }

  if (hobbies !== undefined && hobbies !== null) {
    if (!Number.isInteger(hobbies) || hobbies < 0) return 'hobbies phải là số nguyên không âm';
    if (activeMask !== undefined && (hobbies & ~activeMask) !== 0) {
      return 'hobbies chứa giá trị không hợp lệ (bit hobby không tồn tại hoặc đã inactive)';
    }
  }

  return null;
};

const parseLegacyId = (value, errorConfig) => parseRequiredPositiveId(value, {
  ...errorConfig,
  legacyParseInt: true,
});

const parseStudentPageQuery = (query) => parsePaginationQuery(query, {
  legacyParseInt: true,
  pageError: errors.getByPage.invalidPage,
  sizeError: errors.getByPage.invalidSize,
  toplistOptions: { legacyParseInt: true, invalid: 'omit' },
});

const parseLegacyIdList = (value, errorConfig) => parseIdList(value, { validate: false, errorConfig });

const isValidExportType = (value) => ['csv', 'xlsx', 'json', 'xml'].includes(value);

const parseCopyDrafts = (value, activeMask) => {
  if (!Array.isArray(value) || value.length === 0) throw new AppError(errors.copy.invalidIdList);
  const keys = new Set();
  return value.map((draft, index) => {
    const sourceId = Number(draft?.sourceId);
    const draftKey = typeof draft?.draftKey === 'string' ? draft.draftKey.trim() : '';
    const raw = draft?.values;
    if (!Number.isSafeInteger(sourceId) || sourceId <= 0 || !draftKey || keys.has(draftKey) || !raw || typeof raw !== 'object') {
      throw new AppError({ ...errors.copy.invalidIdList, message: `Draft ${index + 1} không hợp lệ` });
    }
    keys.add(draftKey);
    const values = {
      code: typeof raw.code === 'string' ? raw.code.trim() : '',
      fullname: typeof raw.fullname === 'string' ? raw.fullname.trim() : '',
      dob: raw.dob || null,
      sex: raw.sex ?? null,
      homecity: typeof raw.homecity === 'string' ? raw.homecity.trim() : '',
      address: typeof raw.address === 'string' ? raw.address.trim() : '',
      hair_color: typeof raw.hair_color === 'string' ? raw.hair_color.trim().toUpperCase() : '',
      email: typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : '',
      facebook: typeof raw.facebook === 'string' ? raw.facebook.trim() : '',
      class_id: raw.class_id === '' || raw.class_id == null ? null : Number(raw.class_id),
      username: typeof raw.username === 'string' ? raw.username.trim() : '',
      description: typeof raw.description === 'string' ? raw.description.trim() : '',
      hobbies: raw.hobbies == null || raw.hobbies === '' ? 0 : Number(raw.hobbies),
    };
    if (!values.code || !values.fullname || !values.email || !values.username ||
      (values.class_id !== null && (!Number.isSafeInteger(values.class_id) || values.class_id <= 0)) ||
      !Number.isInteger(values.hobbies)) {
      throw new AppError({ ...errors.copy.invalidIdList, message: `Dữ liệu draft ${index + 1} không hợp lệ` });
    }
    const validation = validateStudent(values, false, activeMask);
    if (validation) throw new AppError({ ...errors.copy.invalidIdList, message: validation });
    return { draftKey, sourceId, values };
  });
};

module.exports = {
  validateStudent,
  parseGetById: (value) => parseLegacyId(value, errors.getById.invalidId),
  parseGetByPage: parseStudentPageQuery,
  parseUpdateId: (value) => parseLegacyId(value, errors.update.invalidId),
  parseDestroyId: (value) => parseLegacyId(value, errors.destroy.invalidId),
  parseMassDestroyIdList: (value) => parseLegacyIdList(value, errors.destroy.invalidIdList),
  parseTrashIdList: (value) => parseIdList(value, { errorConfig: errors.trash.invalidIdList }),
  parseCopyOneId: (value) => parseLegacyId(value, errors.copy.invalidId),
  parseMassCopyIdList: (value) => parseLegacyIdList(value, errors.copy.invalidIdList),
  parseCopyDrafts,
  isValidExportType,
};
