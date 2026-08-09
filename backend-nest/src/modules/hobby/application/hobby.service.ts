import { Inject, Injectable } from '@nestjs/common';
import type { Hobby } from '../domain/hobby.entity';
import {
  HOBBY_PERSISTENCE,
  HOBBY_TRANSACTION,
  HobbyDuplicateError,
  type HobbyPersistencePort,
  type HobbyTransactionPort,
} from '../domain/hobby-persistence.port';
import { type CreateHobbyInput } from './hobby.contracts';
import { HobbyBitExhaustedError, hobbyApplicationException as hobbyException, uniqueHobbyMessage } from './hobby-application.errors';
import { HobbyBitAllocator } from './hobby-bit-allocator';

@Injectable()
export class HobbyService {
  constructor(
    @Inject(HOBBY_PERSISTENCE) private readonly repository: HobbyPersistencePort,
    private readonly bitAllocator: HobbyBitAllocator,
    @Inject(HOBBY_TRANSACTION) private readonly transactions: HobbyTransactionPort,
  ) {}

  getAll(): Promise<Hobby[]> { return this.repository.getActive(); }

  async create(input: CreateHobbyInput): Promise<Hobby> {
    const name = this.normalizeName(input);
    try {
      return await this.transactions.run(async (transaction) => {
        await this.repository.lockBitAllocation(transaction);
        const bitValue = this.bitAllocator.allocate(await this.repository.getUsedBitValues(transaction));
        return this.repository.insert({ code: `HB${bitValue}`, name, bit_value: bitValue, is_active: true }, transaction);
      });
    } catch (error) {
      if (error instanceof HobbyBitExhaustedError) throw hobbyException.bitExhausted(error);
      if (error instanceof HobbyDuplicateError) throw hobbyException.duplicate(uniqueHobbyMessage(error.field), error);
      throw error;
    }
  }

  async delete(id: number): Promise<{ id: string }> {
    return this.transactions.run(async (transaction) => {
      const hobby = await this.repository.findById(id, transaction);
      if (!hobby) throw hobbyException.notFound();
      if (await this.repository.isUsedByActiveStudent(hobby.bit_value, transaction)) throw hobbyException.inUse();
      const deleted = await this.repository.deleteById(id, transaction);
      return { id: deleted?.id ?? String(id) };
    });
  }

  private normalizeName(input: CreateHobbyInput): string {
    const name = input?.name;
    if (!name || name.trim() === '') throw hobbyException.invalidName();
    if (name.trim().length > 30) throw hobbyException.nameTooLong();
    return name.trim();
  }
}
