// Canonical round-trip contract used by every Student export and import file.
// Keep these machine-readable names stable across CSV/XLSX/JSON/XML.
const STUDENT_FILE_COLUMNS = [
  'code', 'fullname', 'dob', 'gender', 'class', 'email', 'username', 'password',
  'homecity', 'address', 'hobbies', 'description', 'hair_color', 'facebook',
];

const formatDate = value => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
};

const formatHobbies = (mask, hobbies) => hobbies
  .filter(hobby => (Number(mask || 0) & Number(hobby.bit_value)) !== 0)
  .map(hobby => hobby.name)
  .join('; ');

const toFileRow = (student, { classes = [], hobbies = [] } = {}) => {
  const classRecord = classes.find(item => Number(item.id) === Number(student.class_id));
  return {
    code: student.code || '',
    fullname: student.fullname || '',
    dob: formatDate(student.dob),
    gender: student.sex === true ? 'Nam' : (student.sex === false ? 'Nữ' : ''),
    class: classRecord?.code || '',
    email: student.email || '',
    username: student.username || '',
    password: '', // Never expose a password or bcrypt hash.
    homecity: student.homecity || '',
    address: student.address || '',
    hobbies: formatHobbies(student.hobbies, hobbies),
    description: student.description || '',
    hair_color: student.hair_color || '',
    facebook: student.facebook || '',
  };
};

const toFileRows = (students, lookups) => students.map(student => toFileRow(student, lookups));

// Keep the template shape in this canonical schema too.  It deliberately
// includes a password example, while exported rows always leave it blank.
const createTemplateRow = () => ({
  code: 'SV001',
  fullname: 'Nguyễn Văn An',
  dob: '15/01/2004',
  gender: 'Nam',
  class: '',
  email: 'sv001@example.com',
  username: 'sv001',
  password: 'Aa1!abcd',
  homecity: 'Hà Nội',
  address: '',
  hobbies: '',
  description: '',
  hair_color: '#000000',
  facebook: '',
});

const normalizeText = value => typeof value === 'string' ? value.trim() : (value == null ? '' : String(value).trim());
const normalizeHobbyName = value => normalizeText(value).toLocaleLowerCase('vi');

const parseHobbyNames = value => {
  const names = new Map();
  normalizeText(value).split(';').map(name => normalizeText(name)).filter(Boolean).forEach((name) => {
    const key = normalizeHobbyName(name);
    if (!names.has(key)) names.set(key, name);
  });
  return [...names.values()];
};

const parseGender = value => {
  const text = normalizeText(value).toLocaleLowerCase('vi');
  if (!text) return null;
  if (['nam', 'true', '1'].includes(text)) return true;
  if (['nữ', 'nu', 'false', '0'].includes(text)) return false;
  return undefined;
};

const parseDate = value => {
  const text = normalizeText(value);
  if (!text) return null;
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return undefined;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() + 1 === Number(month) && date.getUTCDate() === Number(day) ? iso : undefined;
};

const normalizeFileRow = row => ({
  code: normalizeText(row?.code), fullname: normalizeText(row?.fullname), dob: parseDate(row?.dob),
  gender: parseGender(row?.gender ?? row?.sex), class: normalizeText(row?.class ?? row?.class_code ?? row?.class_id),
  email: normalizeText(row?.email).toLowerCase(), username: normalizeText(row?.username), password: normalizeText(row?.password),
  homecity: normalizeText(row?.homecity), address: normalizeText(row?.address), hobbies: parseHobbyNames(row?.hobbies),
  description: normalizeText(row?.description), hair_color: normalizeText(row?.hair_color), facebook: normalizeText(row?.facebook),
});

module.exports = { STUDENT_FILE_COLUMNS, toFileRow, toFileRows, createTemplateRow, normalizeFileRow, normalizeHobbyName, parseHobbyNames };
