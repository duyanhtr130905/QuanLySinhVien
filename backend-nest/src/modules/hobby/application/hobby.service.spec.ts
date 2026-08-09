import type { Hobby } from '../domain/hobby.entity';
import { HobbyDuplicateError, type HobbyPersistencePort, type HobbyTransactionPort } from '../domain/hobby-persistence.port';
import { HobbyBitAllocator } from './hobby-bit-allocator';
import { HobbyService } from './hobby.service';

const hobby: Hobby = { id: '1', code: 'HB1', name: 'Reading', bit_value: 1, is_active: true };

describe('HobbyService', () => {
  const subject = () => {
    const transaction = {};
    const repository = { getActive: jest.fn(), lockBitAllocation: jest.fn(), getUsedBitValues: jest.fn().mockResolvedValue([]), insert: jest.fn().mockResolvedValue(hobby), findById: jest.fn(), isUsedByActiveStudent: jest.fn(), deleteById: jest.fn() };
    const transactions = { run: jest.fn(async (work) => work(transaction)) };
    return { transaction, repository, transactions, service: new HobbyService(repository as unknown as HobbyPersistencePort, new HobbyBitAllocator(), transactions as unknown as HobbyTransactionPort) };
  };

  it('uses focused fake persistence and transaction ports for active list and allocation', async () => {
    const { service, repository, transactions, transaction } = subject();
    repository.getActive.mockResolvedValue([hobby]);
    await expect(service.getAll()).resolves.toEqual([hobby]);
    repository.getUsedBitValues.mockResolvedValue([1, 2, 8]);
    repository.insert.mockImplementation(async (values) => ({ id: '4', ...values }));
    await expect(service.create({ name: ' Reading ' })).resolves.toMatchObject({ code: 'HB4', name: 'Reading', bit_value: 4 });
    expect(transactions.run).toHaveBeenCalledTimes(1);
    expect(repository.lockBitAllocation).toHaveBeenCalledWith(transaction);
    expect(repository.getUsedBitValues).toHaveBeenCalledWith(transaction);
  });

  it('keeps validation, allocation exhaustion, duplicate, and in-use rules', async () => {
    const invalid = subject();
    await expect(invalid.service.create({ name: ' ' })).rejects.toMatchObject({ code: 'E603' });
    expect(invalid.transactions.run).not.toHaveBeenCalled();
    const exhausted = subject();
    exhausted.repository.getUsedBitValues.mockResolvedValue(Array.from({ length: 31 }, (_, power) => 2 ** power));
    await expect(exhausted.service.create({ name: 'A' })).rejects.toMatchObject({ code: 'E604' });
    const duplicate = subject();
    duplicate.repository.insert.mockRejectedValue(new HobbyDuplicateError('name'));
    await expect(duplicate.service.create({ name: 'A' })).rejects.toMatchObject({ code: 'E603' });
    const inUse = subject();
    inUse.repository.findById.mockResolvedValue(hobby);
    inUse.repository.isUsedByActiveStudent.mockResolvedValue(true);
    await expect(inUse.service.delete(1)).rejects.toMatchObject({ code: 'G605' });
    expect(inUse.repository.deleteById).not.toHaveBeenCalled();
  });
});
