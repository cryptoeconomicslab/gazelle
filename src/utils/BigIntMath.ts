export const max = (a: bigint, b: bigint): bigint => {
  if (a >= b) return a
  else return b
}
export const min = (a: bigint, b: bigint): bigint => {
  if (a <= b) return a
  else return b
}

/**
 * makeRanges makes array of nnumbers which are in certain range
 * it's hard to make array which has a large number of items. So, end - start must be SafeNumber size.
 * @param start start of range
 * @param end end of range
 */
export const makeRange = (start: bigint, end: bigint) =>
  Array.from({ length: Number(end - start) + 1 }, (v, k) => BigInt(k) + start)
