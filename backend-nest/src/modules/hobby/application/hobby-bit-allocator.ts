import { Injectable } from '@nestjs/common';
import { HobbyBitExhaustedError } from '../errors/hobby.errors';

@Injectable()
export class HobbyBitAllocator {
  allocate(usedValues: readonly unknown[]): number {
    const used = new Set(
      usedValues.filter((value): value is number => (
        typeof value === 'number'
        && Number.isSafeInteger(value)
        && value > 0
        && value <= 2 ** 30
        && (value & (value - 1)) === 0
      )),
    );

    for (let power = 0; power <= 30; power += 1) {
      const candidate = 2 ** power;
      if (!used.has(candidate)) return candidate;
    }

    throw new HobbyBitExhaustedError();
  }
}
