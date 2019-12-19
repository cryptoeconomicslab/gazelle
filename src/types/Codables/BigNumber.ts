import Codable from './Codable'

export default class BigNumber implements Codable {
  static MAX_NUMBER: BigNumber = new BigNumber(2n ** 256n - 1n)

  static fromString(str: string): BigNumber {
    return new BigNumber(BigInt(str))
  }

  static fromHexString(hex: string): BigNumber {
    const match = hex.match(/^(0x)?([0-9a-fA-F]*)$/)
    if (match) {
      return new BigNumber(BigInt(hex))
    } else {
      throw new Error('invalid hex string')
    }
  }

  static from(data: number | bigint | BigNumber): BigNumber {
    if (typeof data == 'number') {
      return new BigNumber(BigInt(data))
    } else if (typeof data == 'bigint') {
      return new BigNumber(data)
    } else {
      return data
    }
  }

  static default(): BigNumber {
    return new BigNumber(0n)
  }

  constructor(public data: bigint) {}

  public get raw() {
    return this.data.toString()
  }

  public setData(num: bigint) {
    this.data = num
  }

  public toString() {
    return `BigNumber(${this.data})`
  }

  public toTypeString(): string {
    return this.constructor.name
  }
}
