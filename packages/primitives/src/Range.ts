import { Struct, BigNumber, Bytes } from './'
import JSBI from 'jsbi'

export default class Range {
  constructor(readonly start: BigNumber, readonly end: BigNumber) {}
  public static fromBytes(bytes: Bytes): Range {
    const getBigNumber = (b: Uint8Array) =>
      BigNumber.fromHexString(Bytes.from(b).toHexString())
    return new Range(
      getBigNumber(bytes.data.slice(0, 32)),
      getBigNumber(bytes.data.slice(32))
    )
  }

  public toBytes(): Bytes {
    return Bytes.concat(
      [this.start.toHexString(), this.end.toHexString()].map(h =>
        Bytes.fromHexString(h).padZero(32)
      )
    )
  }

  public toStruct(): Struct {
    return new Struct([
      {
        key: 'start',
        value: this.start
      },
      { key: 'end', value: this.end }
    ])
  }

  public static fromStruct(_struct: Struct): Range {
    return new Range(
      _struct.data[0].value as BigNumber,
      _struct.data[1].value as BigNumber
    )
  }

  public static getParamType(): Struct {
    return Struct.from([
      {
        key: 'start',
        value: BigNumber.default()
      },
      { key: 'end', value: BigNumber.default() }
    ])
  }

  public equals(range: Range): boolean {
    return this.start.equals(range.start) && this.end.equals(range.end)
  }

  /**
   * checks if this range contains given range
   * @param range range to be checked if its contained
   */
  public contains(range: Range): boolean {
    return (
      JSBI.greaterThanOrEqual(range.start.data, this.start.data) &&
      JSBI.lessThanOrEqual(range.end.data, this.end.data)
    )
  }
}
