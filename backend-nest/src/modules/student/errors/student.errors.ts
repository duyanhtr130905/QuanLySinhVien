import { LegacyApiException } from '../../../common/http/legacy-api.exception';

const exception = (status: number, code: string, message: string, cause?: Error) => new LegacyApiException({ status, code, message, cause });

export const studentMessages = {
  list: 'L\u1ea5y danh s\u00e1ch sinh vi\u00ean th\u00e0nh c\u00f4ng',
  page: 'L\u1ea5y danh s\u00e1ch sinh vi\u00ean theo trang th\u00e0nh c\u00f4ng',
  detail: 'L\u1ea5y chi ti\u1ebft sinh vi\u00ean th\u00e0nh c\u00f4ng',
  create: 'T\u1ea1o sinh vi\u00ean th\u00e0nh c\u00f4ng',
  update: 'C\u1eadp nh\u1eadt sinh vi\u00ean th\u00e0nh c\u00f4ng',
  delete: 'X\u00f3a sinh vi\u00ean th\u00e0nh c\u00f4ng',
  deletedPage: 'L\u1ea5y danh s\u00e1ch sinh vi\u00ean \u0111\u00e3 x\u00f3a th\u00e0nh c\u00f4ng',
} as const;

export const studentException = {
  invalidPage: () => exception(400, 'C601', 'S\u1ed1 trang kh\u00f4ng h\u1ee3p l\u1ec7'),
  invalidSize: () => exception(400, 'C602', 'C\u1ee1 trang kh\u00f4ng h\u1ee3p l\u1ec7'),
  invalidId: () => exception(400, 'D601', 'id kh\u00f4ng h\u1ee3p l\u1ec7'),
  notFound: () => exception(404, 'D604', 'Kh\u00f4ng t\u00ecm th\u1ea5y sinh vi\u00ean'),
  createValidation: (message: string) => exception(400, 'E603', message),
  createClassNotFound: (cause?: Error) => exception(400, 'E603', 'class_id kh\u00f4ng t\u1ed3n t\u1ea1i', cause),
  createDuplicate: (message: string, cause?: Error) => exception(409, 'E603', message, cause),
  updateInvalidId: () => exception(400, 'F601', 'id kh\u00f4ng h\u1ee3p l\u1ec7'),
  updateValidation: (message: string) => exception(400, 'F603', message),
  updateClassNotFound: (cause?: Error) => exception(400, 'F603', 'class_id kh\u00f4ng t\u1ed3n t\u1ea1i', cause),
  updateDuplicate: (message: string, cause?: Error) => exception(409, 'F603', message, cause),
  updateNotFound: () => exception(404, 'F604', 'Kh\u00f4ng t\u00ecm th\u1ea5y sinh vi\u00ean'),
  destroyInvalidId: () => exception(400, 'G601', 'id kh\u00f4ng h\u1ee3p l\u1ec7'),
  destroyInvalidIds: () => exception(400, 'G603', 'idlist kh\u00f4ng h\u1ee3p l\u1ec7 ho\u1eb7c r\u1ed7ng'),
  destroyNotFound: () => exception(404, 'G604', 'Kh\u00f4ng t\u00ecm th\u1ea5y sinh vi\u00ean'),
  destroyManyNotFound: (ids: unknown[]) => exception(404, 'G604', `Kh\u00f4ng t\u00ecm th\u1ea5y c\u00e1c sinh vi\u00ean (ids: ${ids.join(', ')})`),
  trashInvalidIds: () => exception(400, 'L603', 'idlist kh\u00f4ng h\u1ee3p l\u1ec7 ho\u1eb7c r\u1ed7ng'),
};

export const studentUniqueMessage = (constraint?: string): string => ({
  tra_student_code_key: 'M\u00e3 sinh vi\u00ean (code) \u0111\u00e3 t\u1ed3n t\u1ea1i',
  tra_student_email_key: 'Email \u0111\u00e3 t\u1ed3n t\u1ea1i',
  tra_student_username_key: 'Username \u0111\u00e3 t\u1ed3n t\u1ea1i',
}[constraint ?? ''] ?? 'D\u1eef li\u1ec7u \u0111\u00e3 t\u1ed3n t\u1ea1i (vi ph\u1ea1m r\u00e0ng bu\u1ed9c UNIQUE)');

export const studentCopyException = {
  invalidId: () => exception(400, 'H601', 'id kh\u00f4ng h\u1ee3p l\u1ec7'),
  invalidIds: (message = 'idlist kh\u00f4ng h\u1ee3p l\u1ec7 ho\u1eb7c r\u1ed7ng') => exception(400, 'H603', message),
  notFound: (message = 'Kh\u00f4ng t\u00ecm th\u1ea5y sinh vi\u00ean g\u1ed1c') => exception(404, 'H604', message),
  massNotFound: (ids: unknown[]) => exception(404, 'H604', `Kh\u00f4ng t\u00ecm th\u1ea5y c\u00e1c sinh vi\u00ean g\u1ed1c (ids: ${ids.join(', ')})`),
  conflict: (message: string) => exception(400, 'H603', message),
};
