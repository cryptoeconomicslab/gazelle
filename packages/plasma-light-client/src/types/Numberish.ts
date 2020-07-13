export type Numberish =
  | {
      toString(): string
    }
  | {
      valueOf: string | number
    }
  | {
      [Symbol.toPrimitive]
    }
