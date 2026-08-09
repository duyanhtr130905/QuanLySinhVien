import { LegacyApiException } from '../../../common/http/legacy-api.exception';
export { HobbyBitExhaustedError } from '../application/hobby-application.errors';

export const hobbyMessages = {
  list: 'Lấy danh sách sở thích thành công',
  create: 'Tạo sở thích thành công',
  delete: 'Xóa sở thích thành công',
  invalidName: 'name là bắt buộc và không được để trống',
  nameTooLong: 'name không được vượt quá 30 ký tự',
  bitExhausted: 'Đã hết bit khả dụng cho hobbies',
  duplicateName: 'Tên sở thích đã tồn tại',
  duplicateCode: 'Mã sở thích đã tồn tại',
  duplicateBitValue: 'Xung đột dữ liệu nội bộ (bit_value trùng), vui lòng thử lại',
  duplicate: 'Dữ liệu đã tồn tại (vi phạm ràng buộc UNIQUE)',
  invalidId: 'id không hợp lệ',
  notFound: 'Không tìm thấy hobby',
  inUse: 'Không thể xóa: sở thích này đang được sinh viên sử dụng',
} as const;

export const hobbyException = {
  invalidName: () => new LegacyApiException({ status: 400, code: 'E603', message: hobbyMessages.invalidName }),
  nameTooLong: () => new LegacyApiException({ status: 400, code: 'E603', message: hobbyMessages.nameTooLong }),
  bitExhausted: (cause?: Error) => new LegacyApiException({ status: 422, code: 'E604', message: hobbyMessages.bitExhausted, cause }),
  duplicate: (message: string, cause?: Error) => new LegacyApiException({ status: 409, code: 'E603', message, cause }),
  invalidId: () => new LegacyApiException({ status: 400, code: 'G601', message: hobbyMessages.invalidId }),
  notFound: () => new LegacyApiException({ status: 404, code: 'G604', message: hobbyMessages.notFound }),
  inUse: () => new LegacyApiException({ status: 409, code: 'G605', message: hobbyMessages.inUse }),
};

export function uniqueMessageForConstraint(constraint?: string): string {
  return {
    tra_hobby_name_key: hobbyMessages.duplicateName,
    tra_hobby_code_key: hobbyMessages.duplicateCode,
    tra_hobby_bit_value_key: hobbyMessages.duplicateBitValue,
  }[constraint ?? ''] ?? hobbyMessages.duplicate;
}
