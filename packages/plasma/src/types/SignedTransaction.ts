import {
  Address,
  Range,
  BigNumber,
  Bytes,
  Struct,
  Property
} from '@cryptoeconomicslab/primitives'
import { Transaction, UnsignedTransaction } from './'

export default class SignedTransaction implements Transaction {
  constructor(
    readonly depositContractAddress: Address,
    readonly range: Range,
    readonly maxBlockNumber: BigNumber,
    readonly stateObject: Property,
    readonly from: Address,
    readonly signature: Bytes
  ) {}

  /**
   * return empty instance of StateUpdate
   */
  public static default(): SignedTransaction {
    return new SignedTransaction(
      Address.default(),
      new Range(BigNumber.default(), BigNumber.default()),
      BigNumber.default(),
      new Property(Address.default(), []),
      Address.default(),
      Bytes.default()
    )
  }

  public static getParamType(): Struct {
    return new Struct([
      { key: 'depositContractAddress', value: Address.default() },
      { key: 'range', value: Range.getParamType() },
      { key: 'maxBlockNumber', value: BigNumber.default() },
      { key: 'stateObject', value: Property.getParamType() },
      { key: 'from', value: Address.default() },
      { key: 'signature', value: Bytes.default() }
    ])
  }

  public static fromStruct(struct: Struct): SignedTransaction {
    const depositContractAddress = struct.data[0].value as Address
    const range = struct.data[1].value as Struct
    const maxBlockNumber = struct.data[2].value as BigNumber
    const stateObject = struct.data[3].value as Struct
    const from = struct.data[4].value as Address
    const signature = struct.data[5].value as Bytes

    return new SignedTransaction(
      depositContractAddress as Address,
      Range.fromStruct(range as Struct),
      maxBlockNumber,
      Property.fromStruct(stateObject as Struct),
      from as Address,
      signature as Bytes
    )
  }

  public toStruct(): Struct {
    return new Struct([
      { key: 'depositContractAddress', value: this.depositContractAddress },
      { key: 'range', value: this.range.toStruct() },
      { key: 'maxBlockNumber', value: this.maxBlockNumber },
      { key: 'stateObject', value: this.stateObject.toStruct() },
      { key: 'from', value: this.from },
      { key: 'signature', value: this.signature }
    ])
  }

  public toUnsigned(): UnsignedTransaction {
    return new UnsignedTransaction(
      this.depositContractAddress,
      this.range,
      this.maxBlockNumber,
      this.stateObject,
      this.from
    )
  }

  public toString(): string {
    return `SignedTransaction(depositContractAddress: ${
      this.depositContractAddress.raw
    }, maxBlockNumber: ${
      this.maxBlockNumber.raw
    }, range: ${this.range.toString()}, so: ${
      this.stateObject.deciderAddress.data
    }, from: ${this.from.raw}, signed)`
  }

  public getHash(): Bytes {
    return this.toUnsigned().getHash()
  }

  public get message(): Bytes {
    return ovmContext.coder.encode(this.toUnsigned().toStruct())
  }
}
