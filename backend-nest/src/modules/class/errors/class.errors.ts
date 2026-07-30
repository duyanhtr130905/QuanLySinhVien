import { LegacyApiException } from '../../../common/http/legacy-api.exception';

export const classMessages = {
  list: 'Lấy danh sách lớp thành công', page: 'Lấy danh sách lớp theo trang thành công', detail: 'Lấy chi tiết lớp thành công',
  create: 'Tạo lớp thành công', update: 'Cập nhật lớp thành công', delete: 'Xóa lớp thành công', massDelete: 'Xóa các lớp thành công',
  invalidPage: 'Số trang không hợp lệ', invalidSize: 'Cỡ trang không hợp lệ', invalidId: 'id không hợp lệ',
  classNotFound: 'Không tìm thấy bản ghi lớp học', required: 'code và name là bắt buộc',
  codeTooLong: 'code không được vượt quá 50 ký tự', nameTooLong: 'name không được vượt quá 255 ký tự', nameBlank: 'name không được để trống',
  duplicateCode: 'Mã lớp (code) đã tồn tại', updateDuplicate: 'Mã lớp (code) đã được sử dụng bởi bản ghi khác',
  foreignKeyBlocked: 'Không thể xóa: Lớp học này vẫn còn sinh viên liên kết', invalidIds: 'Danh sách ids không hợp lệ',
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
};
