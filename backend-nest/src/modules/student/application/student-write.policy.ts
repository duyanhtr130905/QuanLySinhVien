import { studentException } from '../errors/student.errors';
import type { StudentWriteInput } from '../domain/student.contracts';

const email = /^[0-9a-zA-Z.\-_]+@[0-9a-zA-Z.\-_]+$/;
const facebook = /^https?:\/\/[0-9a-zA-Z.\-_]+$/;
const password = /^(?=.*[0-9])(?=.*[A-Z])(?=.*[a-z])(?=.*[^A-Za-z0-9\s]).{8,}$/;
const hairColor = /^#[0-9A-Fa-f]{6}$/;

/** Pure boundary policy shared by every Student write transport. */
export class StudentWritePolicy {
  parse(raw: Record<string, unknown> | undefined, create: boolean, activeMask: number): StudentWriteInput {
    const body = raw ?? {};
    const input: StudentWriteInput = {};
    for (const key of ['code', 'fullname', 'homecity', 'address', 'hair_color', 'email', 'username', 'password', 'description'] as const) if (body[key] !== undefined) input[key] = this.text(body[key]);
    if (body.dob !== undefined) input.dob = this.date(body.dob, create);
    if (body.sex !== undefined) input.sex = this.sex(body.sex, create);
    if (body.facebook !== undefined) input.facebook = body.facebook as string | null;
    if (body.class_id !== undefined) input.class_id = this.classId(body.class_id, create);
    if (body.hobbies !== undefined) input.hobbies = this.hobbies(body.hobbies, activeMask, create);
    this.validate(input, create, activeMask);
    return input;
  }

  private text(value: unknown): string { return typeof value === 'string' ? value : String(value); }
  private fail(create: boolean, message: string): never { throw create ? studentException.createValidation(message) : studentException.updateValidation(message); }
  private date(value: unknown, create: boolean): string | null {
    if (value === '' || value === null) return null;
    if (typeof value !== 'string' || !this.validDate(value)) this.fail(create, 'dob không đúng định dạng ngày');
    return value;
  }
  private validDate(value: string): boolean {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;
    const [year, month, day] = match.slice(1).map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }
  private sex(value: unknown, create: boolean): boolean {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return this.fail(create, 'sex phải là true hoặc false');
  }
  private classId(value: unknown, create: boolean): number | null {
    if (value === '' || value === -1 || value === '-1' || value === null) return null;
    const parsed = this.nonNegativeInteger(value);
    if (parsed === null || parsed === 0) return this.fail(create, 'class_id không hợp lệ');
    return parsed;
  }
  private hobbies(value: unknown, activeMask: number, create: boolean): number {
    if (value === '' || value === null) return 0;
    const parsed = this.nonNegativeInteger(value);
    if (parsed === null || (parsed & ~activeMask) !== 0) return this.fail(create, 'hobbies chứa giá trị không hợp lệ (bit hobby không tồn tại hoặc đã inactive)');
    return parsed;
  }
  private nonNegativeInteger(value: unknown): number | null {
    if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? value : null;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  private validate(input: StudentWriteInput, create: boolean, activeMask: number): void {
    const required = (key: keyof StudentWriteInput) => create && (!input[key] || typeof input[key] !== 'string' || input[key].trim() === '');
    if (required('code')) throw studentException.createValidation('code là bắt buộc');
    if (required('fullname')) throw studentException.createValidation('fullname là bắt buộc');
    if (required('email')) throw studentException.createValidation('email là bắt buộc');
    if (required('username')) throw studentException.createValidation('username là bắt buộc');
    if (required('password')) throw studentException.createValidation('password là bắt buộc');
    const fail = (message: string) => this.fail(create, message);
    if (input.code !== undefined && input.code.length > 50) fail('code không được vượt quá 50 ký tự');
    if (input.username !== undefined && input.username.length > 50) fail('username không được vượt quá 50 ký tự');
    if (input.fullname !== undefined && (input.fullname.trim() === '' || input.fullname.length > 30)) fail(input.fullname.trim() === '' ? 'fullname không được để trống' : 'fullname không được vượt quá 30 ký tự');
    for (const [key, max] of [['homecity', 100], ['address', 100], ['hair_color', 7]] as const) if (input[key] !== undefined && input[key]!.length > max) fail(`${key} không được vượt quá ${max} ký tự`);
    if (input.hair_color !== undefined && input.hair_color !== '' && !hairColor.test(input.hair_color)) fail('hair_color không đúng định dạng #RRGGBB');
    if (input.email !== undefined && (input.email.length > 256 || !email.test(input.email))) fail(input.email.length > 256 ? 'email không được vượt quá 256 ký tự' : 'email không đúng định dạng');
    if (input.facebook !== undefined && input.facebook !== null && input.facebook !== '' && (typeof input.facebook !== 'string' || input.facebook.length > 256 || !facebook.test(input.facebook))) fail('facebook phải là URL hợp lệ (http/https)');
    if (input.password !== undefined && input.password !== '' && !password.test(input.password)) fail('password phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt');
    if (input.hobbies !== undefined && (!Number.isInteger(input.hobbies) || input.hobbies < 0 || (input.hobbies & ~activeMask) !== 0)) fail('hobbies chứa giá trị không hợp lệ (bit hobby không tồn tại hoặc đã inactive)');
  }
}
