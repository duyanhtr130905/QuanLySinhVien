import { Injectable } from '@nestjs/common';
import { UniqueConstraintViolationError } from '../../../common/database/errors/database-infrastructure.error';
import { PgTransactionManager } from '../../../common/database/pg-transaction-manager';
import type { Hobby } from '../domain/hobby.entity';
import {
  HobbyBitExhaustedError,
  hobbyException,
  uniqueMessageForConstraint,
} from '../errors/hobby.errors';
import type { CreateHobbyDto } from '../http/dto/create-hobby.dto';
import { HobbyRepository } from '../infrastructure/hobby.repository';
import { HobbyBitAllocator } from './hobby-bit-allocator';

@Injectable()
export class HobbyService {
  constructor(
    private readonly repository: HobbyRepository,
    private readonly bitAllocator: HobbyBitAllocator,
    private readonly transactions: PgTransactionManager,
  ) {}

  getAll(): Promise<Hobby[]> {
    return this.repository.getActive();
  }

  async create(input: CreateHobbyDto): Promise<Hobby> {
    const name = this.normalizeName(input);

    try {
      return await this.transactions.run(async (executor) => {
        await this.repository.lockBitAllocation(executor);
        const bitValue = this.bitAllocator.allocate(await this.repository.getUsedBitValues(executor));
        return this.repository.insert({
          code: `HB${bitValue}`,
          name,
          bit_value: bitValue,
          is_active: true,
        }, executor);
      });
    } catch (error) {
      if (error instanceof HobbyBitExhaustedError) throw hobbyException.bitExhausted(error);
      if (error instanceof UniqueConstraintViolationError) {
        throw hobbyException.duplicate(uniqueMessageForConstraint(error.constraint), error);
      }
      throw error;
    }
  }

  async delete(id: number): Promise<{ id: string }> {
    return this.transactions.run(async (executor) => {
      const hobby = await this.repository.findById(id, executor);
      if (!hobby) throw hobbyException.notFound();

      if (await this.repository.isUsedByActiveStudent(hobby.bit_value, executor)) {
        throw hobbyException.inUse();
      }

      const deleted = await this.repository.deleteById(id, executor);
      return { id: deleted?.id ?? String(id) };
    });
  }

  private normalizeName(input: CreateHobbyDto): string {
    const name = input?.name;
    if (!name || name.trim() === '') throw hobbyException.invalidName();
    if (name.trim().length > 30) throw hobbyException.nameTooLong();
    return name.trim();
  }
}
