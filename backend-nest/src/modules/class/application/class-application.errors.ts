import { LegacyApplicationError } from '../../../common/application/legacy-application.error';

const error = (status: number, code: string, message: string, cause?: Error) => new LegacyApplicationError(status, code, message, { cause });
const classNotFound = 'Kh\u00f4ng t\u00ecm th\u1ea5y b\u1ea3n ghi l\u1edbp h\u1ecdc';

export const classApplicationException = {
  detailNotFound: () => error(404, 'D604', classNotFound),
  createDuplicate: (cause?: Error) => error(409, 'E603', 'M\u00e3 l\u1edbp (code) \u0111\u00e3 t\u1ed3n t\u1ea1i', cause),
  updateNotFound: () => error(404, 'F604', classNotFound),
  updateDuplicate: (cause?: Error) => error(409, 'F603', 'M\u00e3 l\u1edbp (code) \u0111\u00e3 \u0111\u01b0\u1ee3c s\u1eed d\u1ee5ng b\u1edfi b\u1ea3n ghi kh\u00e1c', cause),
  deleteNotFound: () => error(404, 'G604', classNotFound),
  deleteBlocked: (cause?: Error) => error(409, 'G605', 'Kh\u00f4ng th\u1ec3 x\u00f3a: L\u1edbp h\u1ecdc n\u00e0y v\u1eabn c\u00f2n sinh vi\u00ean li\u00ean k\u1ebft', cause),
  membershipClassNotFound: () => error(404, 'L604', classNotFound),
  invalidStudentIds: () => error(400, 'L603', 'studentIds kh\u00f4ng h\u1ee3p l\u1ec7 ho\u1eb7c r\u1ed7ng'),
  membershipStudentNotFound: (ids?: unknown[]) => error(404, 'L605', `Kh\u00f4ng t\u00ecm th\u1ea5y sinh vi\u00ean${ids?.length ? `: ${ids.join(', ')}` : ''}`),
  membershipStudentDeleted: (ids?: unknown[]) => error(409, 'L606', `Sinh vi\u00ean \u0111\u00e3 b\u1ecb x\u00f3a${ids?.length ? `: ${ids.join(', ')}` : ''}`),
  membershipStudentAssigned: (ids?: unknown[]) => error(409, 'L607', `Sinh vi\u00ean \u0111\u00e3 thu\u1ed9c m\u1ed9t l\u1edbp${ids?.length ? `: ${ids.join(', ')}` : ''}`),
  membershipStudentNotInClass: (ids?: unknown[]) => error(409, 'L608', `Sinh vi\u00ean kh\u00f4ng thu\u1ed9c l\u1edbp n\u00e0y${ids?.length ? `: ${ids.join(', ')}` : ''}`),
  copyNotFound: (message = 'Kh\u00f4ng t\u00ecm th\u1ea5y l\u1edbp g\u1ed1c') => error(404, 'H604', message),
  copyDuplicate: (message: string) => error(409, 'E603', message),
  invalidImportFormat: () => error(400, 'J603', '\u0110\u1ecbnh d\u1ea1ng file kh\u00f4ng h\u1ee3p l\u1ec7'),
  invalidImportFile: (message: string) => error(400, 'J603', message),
  exportNotFound: () => error(404, 'K604', classNotFound),
  invalidExport: () => error(400, 'K603', '\u0110\u1ecbnh d\u1ea1ng export kh\u00f4ng h\u1ee3p l\u1ec7'),
};
