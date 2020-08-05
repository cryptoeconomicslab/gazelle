import {
  Address,
  Range,
  BigNumber,
  Bytes,
  Struct,
  Property
} from '@cryptoeconomicslab/primitives'
import { Transaction, UnsignedTransaction, SignedTransaction } from './'

export default class IncludedTransaction implements Transaction {
  constructor(
    readonly depositContractAddress: Address,
    readonly range: Range,
    readonly maxBlockNumber: BigNumber,
    readonly stateObject: Property,
    readonly from: Address,
    readonly signature: Bytes,
    readonly includedBlockNumber: BigNumber
  ) {}

  /**
   * return empty instance of IncludedTransaction
   */
  public static default(): IncludedTransaction {
    return new IncludedTransaction(
      Address.default(),
      new Range(BigNumber.default(), BigNumber.default()),
      BigNumber.default(),
      new Property(Address.default(), []),
      Address.default(),
      Bytes.default(),
      BigNumber.default()
    )
  }

  public static getParamType(): Struct {
    return new Struct([
      { key: 'depositContractAddress', value: Address.default() },
      { key: 'range', value: Range.getParamType() },
      { key: 'maxBlockNumber', value: BigNumber.default() },
      { key: 'stateObject', value: Property.getParamType() },
      { key: 'from', value: Address.default() },
      { key: 'signature', value: Bytes.default() },
      { key: 'includedBlockNumber', value: BigNumber.default() }
    ])
  }

  public static fromSignedTransaction(
    tx: SignedTransaction,
    includedBlockNumber: BigNumber
  ): IncludedTransaction {
    return new IncludedTransaction(
      tx.depositContractAddress,
      tx.range,
      tx.maxBlockNumber,
      tx.stateObject,
      tx.from,
      tx.signature,
      includedBlockNumber
    )
  }

  public static fromStruct(struct: Struct): IncludedTransaction {
    const depositContractAddress = struct.data[0].value as Address
    const range = struct.data[1].value as Struct
    const maxBlockNumber = struct.data[2].value as BigNumber
    const stateObject = struct.data[3].value as Struct
    const from = struct.data[4].value as Address
    const signature = struct.data[5].value as Bytes
    const includedBlockNumber = struct.data[6].value as BigNumber

    return new IncludedTransaction(
      depositContractAddress as Address,
      Range.fromStruct(range as Struct),
      maxBlockNumber,
      Property.fromStruct(stateObject as Struct),
      from as Address,
      signature,
      includedBlockNumber
    )
  }

  public toStruct(): Struct {
    return new Struct([
      { key: 'depositContractAddress', value: this.depositContractAddress },
      { key: 'range', value: this.range.toStruct() },
      { key: 'maxBlockNumber', value: this.maxBlockNumber },
      { key: 'stateObject', value: this.stateObject.toStruct() },
      { key: 'from', value: this.from },
      { key: 'signature', value: this.signature },
      { key: 'includedBlockNumber', value: this.includedBlockNumber }
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

  public toSigned(): SignedTransaction {
    return new SignedTransaction(
      this.depositContractAddress,
      this.range,
      this.maxBlockNumber,
      this.stateObject,
      this.from,
      this.signature
    )
  }

  public toString(): string {
    return `IncludedTransaction(depositContractAddress: ${
      this.depositContractAddress.raw
    }, maxBlockNumber: ${
      this.maxBlockNumber.raw
    }, range: ${this.range.toString()}, so: ${
      this.stateObject.deciderAddress.data
    }, from: ${this.from.raw}, included)`
  }

  public getHash(): Bytes {
    return this.toUnsigned().getHash()
  }

  public get message(): Bytes {
    return ovmContext.coder.encode(this.toUnsigned().toStruct())
  }
}
