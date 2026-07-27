export const isPositivePowerOfTwo = value => {
  const number = Number(value)
  return (
    Number.isSafeInteger(number) &&
    number > 0 &&
    Number.isInteger(Math.log2(number))
  )
}

export const encodeHobbyBitmask = (values, allowedValues) => {
  if (!Array.isArray(values)) return 0

  const allowedSet = Array.isArray(allowedValues)
    ? new Set(allowedValues.map(Number).filter(isPositivePowerOfTwo))
    : null
  const validValues = values
    .map(Number)
    .filter(value => isPositivePowerOfTwo(value) && (!allowedSet || allowedSet.has(value)))

  return [...new Set(validValues)].reduce((mask, value) => mask + value, 0)
}

export const decodeHobbyBitmask = (maskValue, hobbyOptions) => {
  const mask = Number(maskValue)
  if (!Number.isSafeInteger(mask) || mask <= 0 || !Array.isArray(hobbyOptions)) return []

  return hobbyOptions.filter(item => {
    const bitValue = Number(item?.bit_value)
    return isPositivePowerOfTwo(bitValue) && (mask & bitValue) === bitValue
  })
}
