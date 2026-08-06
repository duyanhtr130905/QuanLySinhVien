import { LegacyApiException } from '../../../common/http/legacy-api.exception';

export const classMessages = {
  list: 'Lấy danh sách lớp thành công', page: 'Lấy danh sách lớp theo trang thành công', detail: 'Lấy chi tiết lớp thành công',
  create: 'Tạo lớp thành công', update: 'Cập nhật lớp thành công', delete: 'Xóa lớp thành công', massDelete: 'Xóa các lớp thành công',
  invalidPage: 'Số trang không hợp lệ', invalidSize: 'Cỡ trang không hợp lệ', invalidId: 'id không hợp lệ',
  classNotFound: 'Không tìm thấy bản ghi lớp học', required: 'code và name là bắt buộc',
  codeTooLong: 'code không được vượt quá 50 ký tự', nameTooLong: 'name không được vượt quá 255 ký tự', nameBlank: 'name không được để trống',
  duplicateCode: 'Mã lớp (code) đã tồn tại', updateDuplicate: 'Mã lớp (code) đã được sử dụng bởi bản ghi khác',
  foreignKeyBlocked: 'Không thể xóa: Lớp học này vẫn còn sinh viên liên kết', invalidIds: 'Danh sách ids không hợp lệ',
  students: 'L\u1ea5y danh s\u00e1ch sinh vi\u00ean trong l\u1edbp th\u00e0nh c\u00f4ng', availableStudents: 'L\u1ea5y danh s\u00e1ch sinh vi\u00ean c\u00f3 th\u1ec3 th\u00eam v\u00e0o l\u1edbp th\u00e0nh c\u00f4ng', assignStudents: 'Th\u00eam sinh vi\u00ean v\u00e0o l\u1edbp th\u00e0nh c\u00f4ng', removeStudents: 'Lo\u1ea1i sinh vi\u00ean kh\u1ecfi l\u1edbp th\u00e0nh c\u00f4ng',
  copyOne: 'Sao ch\u00e9p l\u1edbp th\u00e0nh c\u00f4ng', copyValidate: '\u00c4\u0090\u00c3\u00a3 ki\u00e1\u00bb\u0083m tra c\u00c3\u00a1c b\u00e1\u00ba\u00a3n sao l\u00e1\u00bb\u009bp',
  import: (created: number, failed: number) => `Import th\u00e0nh c\u00f4ng ${created} d\u00f2ng, l\u1ed7i ${failed} d\u00f2ng`,
} as const;

const exception = (status: number, code: string, message: string, cause?: Error) => new LegacyApiException({ status, code, message, cause });

export const classException = {
  invalidPage: () => exception(400, 'C601', classMessages.invalidPage), invalidSize: () => exception(400, 'C602', classMessages.invalidSize),
  invalidDetailId: () => exception(400, 'D601', classMessages.invalidId), detailNotFound: () => exception(404, 'D604', classMessages.classNotFound),
  required: () => exception(400, 'E603', classMessages.required), codeTooLong: () => exception(400, 'E603', classMessages.codeTooLong),
  createNameTooLong: () => exception(400, 'E603', classMessages.nameTooLong), createDuplicate: (cause?: Error) => exception(409, 'E603', classMessages.duplicateCode, cause),
  invalidUpdateId: () => exception(400, 'F601', classMessages.invalidId), updateNameTooLong: () => exception(400, 'F603', classMessages.nameTooLong),
  updateNameBlank: () => exception(400, 'F603', classMessages.nameBlank), updateNotFound: () => exception(404, 'F604', classMessages.classNotFound), updateDuplicate: (cause?: Error) => exception(409, 'F603', classMessages.updateDuplicate, cause),
  invalidDeleteId: () => exception(400, 'G601', classMessages.invalidId), deleteNotFound: () => exception(404, 'G604', classMessages.classNotFound),
  deleteBlocked: (cause?: Error) => exception(409, 'G605', classMessages.foreignKeyBlocked, cause),
  invalidMassDeleteIds: () => exception(400, 'I604', classMessages.invalidIds),
  invalidMembershipId: () => exception(400, 'L601', 'id kh\u00f4ng h\u1ee3p l\u1ec7'), invalidStudentIds: () => exception(400, 'L603', 'studentIds kh\u00f4ng h\u1ee3p l\u1ec7 ho\u1eb7c r\u1ed7ng'), membershipClassNotFound: () => exception(404, 'L604', classMessages.classNotFound), membershipStudentNotFound: (ids?: unknown[]) => exception(404, 'L605', `Kh\u00f4ng t\u00ecm th\u1ea5y sinh vi\u00ean${ids?.length ? `: ${ids.join(', ')}` : ''}`), membershipStudentDeleted: (ids?: unknown[]) => exception(409, 'L606', `Sinh vi\u00ean \u0111\u00e3 b\u1ecb x\u00f3a${ids?.length ? `: ${ids.join(', ')}` : ''}`), membershipStudentAssigned: (ids?: unknown[]) => exception(409, 'L607', `Sinh vi\u00ean \u0111\u00e3 thu\u1ed9c m\u1ed9t l\u1edbp${ids?.length ? `: ${ids.join(', ')}` : ''}`), membershipStudentNotInClass: (ids?: unknown[]) => exception(409, 'L608', `Sinh vi\u00ean kh\u00f4ng thu\u1ed9c l\u1edbp n\u00e0y${ids?.length ? `: ${ids.join(', ')}` : ''}`), invalidMembershipPage: () => exception(400, 'L609', 'S\u1ed1 trang kh\u00f4ng h\u1ee3p l\u1ec7'), invalidMembershipSize: () => exception(400, 'L610', 'C\u1ee1 trang kh\u00f4ng h\u1ee3p l\u1ec7'),
  invalidCopyId: () => exception(400, 'H601', classMessages.invalidId), invalidCopyDrafts: (message: string = 'idlist kh\u00f4ng h\u1ee3p l\u1ec7 ho\u1eb7c r\u1ed7ng') => exception(400, 'H603', message), copyNotFound: (message: string = 'Kh\u00f4ng t\u00ecm th\u1ea5y b\u1ea3n ghi l\u1edbp h\u1ecdc g\u1ed1c') => exception(404, 'H604', message), copyDuplicate: (message: string = classMessages.duplicateCode) => exception(409, 'E603', message),
  invalidImportFormat: () => exception(400, 'J601', '\u0110\u1ecbnh d\u1ea1ng file kh\u00f4ng \u0111\u01b0\u1ee3c h\u1ed7 tr\u1ee3 (ch\u1ec9 csv/xlsx/json/xml)'), invalidImportFile: (message: string) => exception(400, 'J604', message), invalidExport: (message = '\u0110\u1ecbnh d\u1ea1ng export kh\u00f4ng h\u1ee3p l\u1ec7 (ch\u1ec9 csv/xlsx/json/xml)') => exception(400, 'K601', message), invalidExportId: () => exception(400, 'K601', classMessages.invalidId), invalidExportIds: () => exception(400, 'K601', 'idlist kh\u00f4ng h\u1ee3p l\u1ec7 ho\u1eb7c r\u1ed7ng'), exportNotFound: () => exception(404, 'K604', classMessages.classNotFound),
};
