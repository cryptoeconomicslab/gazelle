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
    readonly chunkId: Bytes,
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
      Bytes.default(),
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
      { key: 'chunkId', value: Bytes.default() },
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
      tx.chunkId,
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
    const chunkId = struct.data[4].value as Bytes
    const from = struct.data[5].value as Address
    const signature = struct.data[6].value as Bytes
    const includedBlockNumber = struct.data[7].value as BigNumber

    return new IncludedTransaction(
      depositContractAddress,
      Range.fromStruct(range),
      maxBlockNumber,
      Property.fromStruct(stateObject),
      chunkId,
      from,
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
      { key: 'chunkId', value: this.chunkId },
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
      this.chunkId,
      this.from
    )
  }

  public toSigned(): SignedTransaction {
    return new SignedTransaction(
      this.depositContractAddress,
      this.range,
      this.maxBlockNumber,
      this.stateObject,
      this.chunkId,
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
    }, chunkId: ${this.chunkId.toHexString()}, from: ${
      this.from.raw
    }, included)`
  }

  public getHash(): Bytes {
    return this.toUnsigned().getHash()
  }

  public get message(): Bytes {
    return ovmContext.coder.encode(this.toUnsigned().toStruct())
  }
}
