import { Inject, Injectable } from '@nestjs/common';
import { FileCodecRegistry } from '../../../common/files/file-codec.registry';
import type { FileFormat } from '../../../common/files/file-format.type';
import { LegacyApiException } from '../../../common/http/legacy-api.exception';
import { PASSWORD_HASHER } from '../../../common/security/security.tokens';
import type { PasswordHasher } from '../../../common/security/password-hasher.interface';
import { STUDENT_IMPORT_EXPORT_PORT, STUDENT_TRANSACTION, StudentImportUniqueConflictError, type StudentImportCreate, type StudentImportExportPort, type StudentImportFile, type StudentImportLookup, type StudentImportPreview, type StudentImportStudentRecord, type StudentImportUpdate, type StudentPersistenceTransaction, type StudentTransactionPort } from '../domain/student-persistence.port';

const columns = ['code', 'fullname', 'dob', 'gender', 'class', 'email', 'username', 'password', 'homecity', 'address', 'hobbies', 'description', 'hair_color', 'facebook'] as const;
const formats = ['csv', 'xlsx', 'json', 'xml'] as const;
const contentTypes: Record<FileFormat, string> = { csv: 'text/csv', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', json: 'application/json', xml: 'application/xml' };
const email = /^[0-9a-zA-Z.\-_]+@[0-9a-zA-Z.\-_]+$/;
const password = /^(?=.*[0-9])(?=.*[A-Z])(?=.*[a-z])(?=.*[^A-Za-z0-9\s]).{8,}$/;

type Values = { code: string; fullname: string; dob: string | null | undefined; gender: boolean | null | undefined; class: string; email: string; username: string; password: string; homecity: string; address: string; hobbies: string[]; description: string; hair_color: string; facebook: string };
type Draft = { draftKey: string; rowNumber: number; values: Values };

@Injectable()
export class StudentImportExportService {
  constructor(@Inject(STUDENT_IMPORT_EXPORT_PORT) private readonly imports: StudentImportExportPort, @Inject(STUDENT_TRANSACTION) private readonly transactions: StudentTransactionPort, private readonly codecs: FileCodecRegistry, @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasher) {}

  async template(type: unknown): Promise<StudentImportFile> { return this.file([this.templateRow()], this.format(type), 'student-import-template'); }

  async exportOne(id: number, type: unknown): Promise<StudentImportFile> {
    const record = await this.imports.findActiveById(id);
    if (!record) throw this.error(404, 'K604', 'Không tìm thấy sinh viên');
    return this.exportRows([record], this.format(type), `student-${id}`);
  }

  async exportMany(ids: unknown[], type: unknown): Promise<StudentImportFile> { return this.exportRows(await this.imports.findActiveByIds(ids), this.format(type), 'students-export'); }

  async preview(buffer: Buffer, filename: string): Promise<StudentImportPreview> {
    const format = filename.split('.').pop()?.toLowerCase() as FileFormat;
    let rows: Record<string, unknown>[];
    try { rows = await this.codecs.get(format).parse(buffer); }
    catch (error) {
      if (error instanceof Error && error.message.startsWith('unsupported file format')) throw this.error(400, 'J601', 'Định dạng file không được hỗ trợ (chỉ csv/xlsx/json/xml)');
      throw this.error(400, 'J604', 'Cannot parse import file');
    }
    if (!rows.length) throw this.error(400, 'J604', 'Import file has no rows');
    return this.validate(rows.map((values, index) => ({ draftKey: `import-${index + 1}`, rowNumber: index + 2, values })));
  }

  async validate(raw: unknown, transaction?: StudentPersistenceTransaction): Promise<StudentImportPreview> {
    const input = Array.isArray(raw) ? raw : [];
    const normalized = input.map((item) => this.values((item as { values?: Record<string, unknown> })?.values));
    const valuesFor = (field: keyof Values) => [...new Set(normalized.map((value) => value[field]).filter((value): value is string => typeof value === 'string' && Boolean(value)))];
    const [lookups, existing] = await Promise.all([
      this.imports.findImportLookups(transaction),
      this.imports.findActiveByUniqueValues({ code: valuesFor('code'), email: valuesFor('email'), username: valuesFor('username') }, transaction),
    ]);
    const classByCode = new Map(lookups.classes.map((item) => [this.key(item.code), item]));
    const hobbyByName = new Map(lookups.hobbies.map((item) => [this.key(item.name), item]));
    const existingByCode = new Map(existing.map((item) => [item.code, item]));
    const counts = { code: new Map<string, number>(), email: new Map<string, number>(), username: new Map<string, number>() };
    normalized.forEach((value) => { (['code', 'email', 'username'] as const).forEach((field) => { if (value[field]) counts[field].set(value[field], (counts[field].get(value[field]) ?? 0) + 1); }); });
    const rows = input.map((rawItem, index) => this.validationRow(rawItem, index, normalized[index], existing, existingByCode, counts, classByCode, hobbyByName));
    return { rows, lookups };
  }

  async commit(raw: unknown) {
    try {
      return await this.transactions.run(async (transaction) => {
        const preview = await this.validate(raw, transaction);
        const invalid = preview.rows.filter((row) => row.status !== 'valid');
        if (invalid.length) throw this.error(400, 'J604', 'Import drafts are invalid', invalid);
        const lookups = preview.lookups!;
        const classes = new Map(lookups.classes.map((row) => [this.key(row.code), row]));
        const hobbies = new Map(lookups.hobbies.map((row) => [this.key(row.name), row]));
        const locked = new Map((await this.imports.lockActiveByCodes(preview.rows.map((row) => String((row.values as Values).code)), transaction)).map((row) => [row.code, row]));
        const created: unknown[] = []; const updated: unknown[] = [];
        for (const row of preview.rows as Array<ReturnType<StudentImportExportService['validationRow']>>) {
          const values = row.values;
          const write = this.writeValues(values, classes, hobbies);
          const current = locked.get(values.code);
          if (current) {
            const update: StudentImportUpdate = values.password ? { ...write, password: await this.passwords.hash(values.password) } : write;
            updated.push({ draftKey: row.draftKey, rowNumber: row.rowNumber, record: await this.imports.updateImport(current.id, update, transaction) });
          } else {
            const create: StudentImportCreate = { ...write, password: await this.passwords.hash(values.password) };
            created.push({ draftKey: row.draftKey, rowNumber: row.rowNumber, record: await this.imports.insertImport(create, transaction) });
          }
        }
        return { created, updated };
      });
    } catch (error) { if (error instanceof StudentImportUniqueConflictError) throw this.error(409, 'J604', 'Duplicate student data'); throw error; }
  }

  commitSafe(raw: unknown) { return this.commit(raw); }

  private validationRow(rawItem: unknown, index: number, values: Values, existing: StudentImportStudentRecord[], existingByCode: Map<string, StudentImportStudentRecord>, counts: { code: Map<string, number>; email: Map<string, number>; username: Map<string, number> }, classByCode: Map<string, StudentImportLookup>, hobbyByName: Map<string, StudentImportLookup>) {
    const item = rawItem as Partial<Draft>; const errors: Record<string, string> = {}; const current = existingByCode.get(values.code);
    if (!values.code) errors.code = 'Mã sinh viên là bắt buộc'; else if (values.code.length > 50) errors.code = 'Mã sinh viên quá 50 ký tự'; else if ((counts.code.get(values.code) ?? 0) > 1) errors.code = 'Mã sinh viên bị trùng trong file';
    if (!values.fullname) errors.fullname = 'Họ tên là bắt buộc'; else if (values.fullname.length > 30) errors.fullname = 'Họ tên quá 30 ký tự';
    if (!values.email || !email.test(values.email)) errors.email = 'Email không hợp lệ'; else if ((counts.email.get(values.email) ?? 0) > 1) errors.email = 'Email bị trùng trong file';
    if (!values.username) errors.username = 'Username là bắt buộc'; else if (values.username.length > 50) errors.username = 'Username quá 50 ký tự'; else if ((counts.username.get(values.username) ?? 0) > 1) errors.username = 'Username bị trùng trong file';
    if (values.gender === undefined) errors.gender = 'Giới tính phải là Nam/Nữ hoặc True/False/1/0';
    if (values.dob === undefined) errors.dob = 'Ngày sinh phải theo DD/MM/YYYY';
    for (const other of existing) { if (other.code !== values.code && other.email === values.email) errors.email = `Email đã thuộc về sinh viên ${other.code}`; if (other.code !== values.code && other.username === values.username) errors.username = `Username đã thuộc về sinh viên ${other.code}`; }
    if (!current && !values.password) errors.password = 'Password bắt buộc khi tạo mới';
    if (values.password && (/^\$2[aby]\$/.test(values.password) || !password.test(values.password))) errors.password = 'Password import không hợp lệ';
    if (values.class && !classByCode.has(this.key(values.class))) errors.class = 'Lớp không tồn tại';
    if (values.homecity.length > 100) errors.homecity = 'homecity exceeds 100 characters';
    if (values.address.length > 100) errors.address = 'address exceeds 100 characters';
    if (values.hair_color.length > 7) errors.hair_color = 'hair_color exceeds 7 characters';
    if (values.email.length > 256) errors.email = 'email exceeds 256 characters';
    if (values.facebook && (values.facebook.length > 256 || !/^https?:\/\/[0-9a-zA-Z.\-_]+$/.test(values.facebook))) errors.facebook = 'facebook must be a valid http/https URL';
    const missingHobbies = values.hobbies.filter((name) => !hobbyByName.has(this.key(name)));
    if (missingHobbies.length) errors.hobbies = `Hobby chưa tồn tại: ${missingHobbies.join('; ')}`;
    return { draftKey: typeof item.draftKey === 'string' ? item.draftKey : `import-${index + 1}`, rowNumber: Number(item.rowNumber) || index + 2, values, mode: current ? 'update' : 'create', errors, fieldErrors: errors, missingHobbies, status: Object.keys(errors).length ? 'invalid' : 'valid' };
  }

  private writeValues(values: Values, classes: Map<string, StudentImportLookup>, hobbies: Map<string, StudentImportLookup>): Omit<StudentImportCreate, 'password'> {
    return { code: values.code, fullname: values.fullname, dob: values.dob ?? null, sex: values.gender ?? null, class_id: values.class ? classes.get(this.key(values.class))!.id : null, email: values.email, username: values.username, homecity: values.homecity || null, address: values.address || null, hobbies: values.hobbies.reduce((mask, name) => mask | Number(hobbies.get(this.key(name))!.bit_value), 0), description: values.description || null, hair_color: values.hair_color || null, facebook: values.facebook || null };
  }

  private async exportRows(records: StudentImportStudentRecord[], format: FileFormat, name: string): Promise<StudentImportFile> {
    const lookups = await this.imports.findImportLookups(); const classes = new Map(lookups.classes.map((row) => [row.id, String(row.code)]));
    return this.file(records.map((row) => ({ code: row.code || '', fullname: row.fullname || '', dob: this.date(row.dob), gender: row.sex === true ? 'Nam' : row.sex === false ? 'Nữ' : '', class: classes.get(Number(row.class_id)) || '', email: row.email || '', username: row.username || '', password: '', homecity: row.homecity || '', address: row.address || '', hobbies: lookups.hobbies.filter((hobby) => Number(row.hobbies || 0) & Number(hobby.bit_value)).map((hobby) => hobby.name).join('; '), description: row.description || '', hair_color: row.hair_color || '', facebook: row.facebook || '' })), format, name);
  }

  private async file(rows: Record<string, unknown>[], format: FileFormat, name: string): Promise<StudentImportFile> { return { buffer: await this.codecs.get(format).encode(rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column] ?? ''])))), contentType: contentTypes[format], filename: `${name}.${format}` }; }
  private values(raw: Record<string, unknown> | undefined): Values { const text = (value: unknown) => typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim(); const gender = text(raw?.gender ?? raw?.sex).toLocaleLowerCase('vi'); const dob = text(raw?.dob); const hobbies = [...new Map(text(raw?.hobbies).split(';').map((item) => item.trim()).filter(Boolean).map((item) => [this.key(item), item])).values()]; return { code: text(raw?.code), fullname: text(raw?.fullname), dob: !dob ? null : /^\d{2}\/\d{2}\/\d{4}$/.test(dob) ? this.iso(dob) : /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : undefined, gender: !gender ? null : ['nam', 'true', '1'].includes(gender) ? true : ['nữ', 'nu', 'false', '0'].includes(gender) ? false : undefined, class: text(raw?.class ?? raw?.class_code ?? raw?.class_id), email: text(raw?.email).toLowerCase(), username: text(raw?.username), password: text(raw?.password), homecity: text(raw?.homecity), address: text(raw?.address), hobbies, description: text(raw?.description), hair_color: text(raw?.hair_color), facebook: text(raw?.facebook) }; }
  private templateRow() { return { code: 'SV001', fullname: 'Nguyễn Văn An', dob: '15/01/2004', gender: 'Nam', class: '', email: 'sv001@example.com', username: 'sv001', password: 'Aa1!abcd', homecity: 'Hà Nội', address: '', hobbies: '', description: '', hair_color: '#000000', facebook: '' }; }
  private format(value: unknown): FileFormat { const format = String(value ?? 'xlsx').toLowerCase(); if (!(formats as readonly string[]).includes(format)) throw this.error(400, 'K601', 'Định dạng export không hợp lệ (chỉ csv/xlsx/json/xml)'); return format as FileFormat; }
  private key(value: unknown) { return String(value ?? '').trim().toLocaleLowerCase('vi'); }
  private iso(value: string) { const [, day, month, year] = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)!; const date = new Date(`${year}-${month}-${day}T00:00:00Z`); return date.getUTCFullYear() === Number(year) && date.getUTCMonth() + 1 === Number(month) && date.getUTCDate() === Number(day) ? `${year}-${month}-${day}` : undefined; }
  private date(value: unknown) { if (!value) return ''; const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? '' : `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`; }
  private error(status: number, code: string, message: string, data: unknown = null) { return new LegacyApiException({ status, code, message, data }); }
}
