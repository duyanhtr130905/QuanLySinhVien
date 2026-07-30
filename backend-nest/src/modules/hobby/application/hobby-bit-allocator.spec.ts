import { HobbyBitExhaustedError } from '../errors/hobby.errors';
import { HobbyBitAllocator } from './hobby-bit-allocator';

describe('HobbyBitAllocator', () => {
  const allocator = new HobbyBitAllocator();

  it.each([
    [[], 1],
    [[1], 2],
    [[1, 2, 8], 4],
    [[8, 2, 1], 4],
    [[1, 3, -2, 2 ** 31], 2],
  ])('allocates the lowest available power-of-two for %j', (used, expected) => {
    expect(allocator.allocate(used)).toBe(expected);
  });

  it('throws when every bit from 2^0 through 2^30 is occupied', () => {
    const allBits = Array.from({ length: 31 }, (_, power) => 2 ** power);

    expect(() => allocator.allocate(allBits)).toThrow(HobbyBitExhaustedError);
  });
});
