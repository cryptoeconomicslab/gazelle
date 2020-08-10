import Codable from './Codable'
import JSBI from 'jsbi'

/**
 * BigNumber class
 * use JSBI as inner representation as polyfill for BigInt
 */
export default class BigNumber implements Codable {
  static MAX_NUMBER: BigNumber = new BigNumber(
    JSBI.subtract(
      JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(256)),
      JSBI.BigInt(1)
    )
  )

  static fromString(str: string): BigNumber {
    return new BigNumber(JSBI.BigInt(str))
  }

  static fromHexString(hex: string): BigNumber {
    const match = hex.match(/^(0x)?([0-9a-fA-F]*)$/)
    if (hex == '0x') hex = '0x00'
    if (match) {
      return new BigNumber(JSBI.BigInt(hex))
    } else {
      throw new Error('invalid hex string')
    }
  }

  static from(data: number | JSBI | BigNumber): BigNumber {
    if (data instanceof BigNumber) return data
    return new BigNumber(JSBI.BigInt(data.toString()))
  }

  static default(): BigNumber {
    return new BigNumber(JSBI.BigInt(0))
  }

  constructor(public data: JSBI) {}

  public get raw() {
    return this.data.toString()
  }

  public setData(num: JSBI) {
    this.data = num
  }

  public toString() {
    return `BigNumber(${this.data})`
  }

  public toHexString(prefixRequired = true) {
    const hex = this.data.toString(16)
    return (prefixRequired ? '0x' : '') + (hex.length % 2 == 1 ? '0' : '') + hex
  }

  public toTypeString(): string {
    return this.constructor.name
  }

  public equals(bigNumber: BigNumber): boolean {
    return this.raw === bigNumber.raw
  }

  public increment(): BigNumber {
    return BigNumber.from(JSBI.add(this.data, JSBI.BigInt(1)))
  }
}
