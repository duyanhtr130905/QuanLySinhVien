import {
  decodeHobbyBitmask, encodeHobbyBitmask, isPositivePowerOfTwo
} from './studentFormUtils'

describe('encodeHobbyBitmask', () => {
  test.each([
    [[], 0],
    [[1], 1],
    [[2, 4], 6],
    [[1, 4, 8], 13],
  ])('encodes %p as %i', (values, expected) => {
    expect(encodeHobbyBitmask(values)).toBe(expected)
  })

  test('ignores duplicates and invalid values', () => {
    expect(encodeHobbyBitmask([1, 1, 3, -2, 4, '8'])).toBe(13)
  })

  test('only encodes values included in the active option list', () => {
    expect(encodeHobbyBitmask([1, 2, 4, 8], [1, 4])).toBe(5)
  })
})

describe('isPositivePowerOfTwo', () => {
  test.each([1, 2, 4, 8, 16])('accepts %i', value => {
    expect(isPositivePowerOfTwo(value)).toBe(true)
  })

  test.each([0, -1, 3, 6, null, undefined])('rejects %p', value => {
    expect(isPositivePowerOfTwo(value)).toBe(false)
  })
})

describe('decodeHobbyBitmask', () => {
  const options = [
    { id: 10, name: 'Thể thao', bit_value: 1 },
    { id: 20, name: 'Đọc sách', bit_value: 2 },
    { id: 30, name: 'Nghệ thuật', bit_value: 4 },
  ]

  test('decodes mask 5 using bit_value, not id', () => {
    expect(decodeHobbyBitmask(5, options).map(item => item.name))
      .toEqual(['Thể thao', 'Nghệ thuật'])
  })

  test.each([0, null, undefined, 'invalid'])('returns empty for %p', value => {
    expect(decodeHobbyBitmask(value, options)).toEqual([])
  })

  test('ignores invalid bit values', () => {
    expect(decodeHobbyBitmask(7, [...options, { name: 'Sai', bit_value: 3 }]))
      .toEqual(options)
  })
})
