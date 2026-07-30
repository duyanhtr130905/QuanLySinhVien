import type { PoolClient } from 'pg';
import { UniqueConstraintViolationError } from '../../../common/database/errors/database-infrastructure.error';
import type { PgTransactionManager } from '../../../common/database/pg-transaction-manager';
import { LegacyApiException } from '../../../common/http/legacy-api.exception';
import type { Hobby } from '../domain/hobby.entity';
import { HobbyBitExhaustedError } from '../errors/hobby.errors';
import type { HobbyRepository } from '../infrastructure/hobby.repository';
import { HobbyBitAllocator } from './hobby-bit-allocator';
import { HobbyService } from './hobby.service';

const hobby: Hobby = { id: '1', code: 'HB1', name: 'Đọc sách', bit_value: 1, is_active: true };

const expectLegacyError = async (
  promise: Promise<unknown>,
  status: number,
  code: string,
  message: string,
) => {
  await expect(promise).rejects.toMatchObject({ status, code, message });
};

describe('HobbyService', () => {
  const createSubject = () => {
    const executor = { query: jest.fn() } as unknown as PoolClient;
    const repository = {
      getActive: jest.fn(),
      lockBitAllocation: jest.fn(),
      getUsedBitValues: jest.fn().mockResolvedValue([]),
      insert: jest.fn().mockResolvedValue(hobby),
      findById: jest.fn(),
      isUsedByActiveStudent: jest.fn(),
      deleteById: jest.fn(),
    };
    const transactions = {
      run: jest.fn(async (work: (client: PoolClient) => Promise<unknown>) => work(executor)),
    };
    return {
      executor,
      repository,
      transactions,
      service: new HobbyService(
        repository as unknown as HobbyRepository,
        new HobbyBitAllocator(),
        transactions as unknown as PgTransactionManager,
      ),
    };
  };

  it('gets active hobbies from the repository', async () => {
    const { service, repository } = createSubject();
    repository.getActive.mockResolvedValue([hobby]);

    await expect(service.getAll()).resolves.toEqual([hobby]);
    expect(repository.getActive).toHaveBeenCalledWith();
  });

  it('trims the name, allocates the lowest bit, and uses one transaction executor', async () => {
    const { service, repository, transactions, executor } = createSubject();
    repository.getUsedBitValues.mockResolvedValue([1, 2, 8]);
    repository.insert.mockImplementation(async (values) => ({ id: 4, ...values }));

    await expect(service.create({ name: '  Đọc sách  ' })).resolves.toEqual({
      id: 4, code: 'HB4', name: 'Đọc sách', bit_value: 4, is_active: true,
    });

    expect(transactions.run).toHaveBeenCalledTimes(1);
    expect(repository.lockBitAllocation).toHaveBeenCalledWith(executor);
    expect(repository.getUsedBitValues).toHaveBeenCalledWith(executor);
    expect(repository.insert).toHaveBeenCalledWith({
      code: 'HB4', name: 'Đọc sách', bit_value: 4, is_active: true,
    }, executor);
  });

  it('keeps legacy validation errors before opening a transaction', async () => {
    const { service, transactions } = createSubject();

    await expectLegacyError(service.create({ name: '   ' }), 400, 'E603', 'name là bắt buộc và không được để trống');
    await expectLegacyError(service.create({ name: 'x'.repeat(31) }), 400, 'E603', 'name không được vượt quá 30 ký tự');
    expect(transactions.run).not.toHaveBeenCalled();
  });

  it('maps exhausted bits and unique constraints to the legacy create contract', async () => {
    const exhausted = createSubject();
    exhausted.repository.getUsedBitValues.mockResolvedValue(Array.from({ length: 31 }, (_, power) => 2 ** power));
    await expectLegacyError(exhausted.service.create({ name: 'A' }), 422, 'E604', 'Đã hết bit khả dụng cho hobbies');

    const duplicate = createSubject();
    duplicate.repository.insert.mockRejectedValue(new UniqueConstraintViolationError('duplicate', {
      constraint: 'tra_hobby_name_key',
    }));
    await expectLegacyError(duplicate.service.create({ name: 'A' }), 409, 'E603', 'Tên sở thích đã tồn tại');
  });

  it('preserves unknown create errors for the controller fallback', async () => {
    const { service, repository } = createSubject();
    const expected = new Error('database timeout');
    repository.getUsedBitValues.mockRejectedValue(expected);

    await expect(service.create({ name: 'A' })).rejects.toBe(expected);
  });

  it('deletes within a transaction after checking the hobby and active student usage', async () => {
    const { service, repository, executor } = createSubject();
    repository.findById.mockResolvedValue(hobby);
    repository.isUsedByActiveStudent.mockResolvedValue(false);
    repository.deleteById.mockResolvedValue(hobby);

    await expect(service.delete(1)).resolves.toEqual({ id: '1' });
    expect(repository.findById).toHaveBeenCalledWith(1, executor);
    expect(repository.isUsedByActiveStudent).toHaveBeenCalledWith(1, executor);
    expect(repository.deleteById).toHaveBeenCalledWith(1, executor);
  });

  it('maps missing and in-use hobbies and does not delete an in-use hobby', async () => {
    const missing = createSubject();
    missing.repository.findById.mockResolvedValue(null);
    await expectLegacyError(missing.service.delete(1), 404, 'G604', 'Không tìm thấy hobby');

    const inUse = createSubject();
    inUse.repository.findById.mockResolvedValue(hobby);
    inUse.repository.isUsedByActiveStudent.mockResolvedValue(true);
    await expectLegacyError(inUse.service.delete(1), 409, 'G605', 'Không thể xóa: sở thích này đang được sinh viên sử dụng');
    expect(inUse.repository.deleteById).not.toHaveBeenCalled();
  });
});
