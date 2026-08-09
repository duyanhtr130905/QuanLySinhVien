import { LegacyApplicationError } from '../../../common/application/legacy-application.error';
import type { HobbyDuplicateField } from '../domain/hobby-persistence.port';

const error = (status: number, code: string, message: string, cause?: Error) => new LegacyApplicationError(status, code, message, { cause });

export class HobbyBitExhaustedError extends Error {
  constructor() { super('Đã hết bit khả dụng cho hobbies'); this.name = new.target.name; }
}

export const hobbyApplicationException = {
  invalidName: () => error(400, 'E603', 'name là bắt buộc và không được để trống'),
  nameTooLong: () => error(400, 'E603', 'name không được vượt quá 30 ký tự'),
  bitExhausted: (cause?: Error) => error(422, 'E604', 'Đã hết bit khả dụng cho hobbies', cause),
  duplicate: (message: string, cause?: Error) => error(409, 'E603', message, cause),
  notFound: () => error(404, 'G604', 'Không tìm thấy hobby'),
  inUse: () => error(409, 'G605', 'Không thể xóa: sở thích này đang được sinh viên sử dụng'),
};

const uniqueMessages: Partial<Record<HobbyDuplicateField, string>> = {
  name: 'Tên sở thích đã tồn tại',
  code: 'Mã sở thích đã tồn tại',
  bitValue: 'Xung đột dữ liệu nội bộ (bit_value trùng), vui lòng thử lại',
};

export const uniqueHobbyMessage = (field?: HobbyDuplicateField): string => (field ? uniqueMessages[field] : undefined) ?? 'Dữ liệu đã tồn tại (vi phạm ràng buộc UNIQUE)';
