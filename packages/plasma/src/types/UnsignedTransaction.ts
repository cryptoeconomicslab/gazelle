import {
  Address,
  Range,
  BigNumber,
  Bytes,
  Struct,
  Property
} from '@cryptoeconomicslab/primitives'
import { Wallet } from '@cryptoeconomicslab/wallet'
import { Keccak256 } from '@cryptoeconomicslab/hash'
import { Transaction, SignedTransaction } from './'

export default class UnsignedTransaction implements Transaction {
  constructor(
    readonly depositContractAddress: Address,
    readonly range: Range,
    readonly maxBlockNumber: BigNumber,
    readonly stateObject: Property,
    readonly chunkId: Bytes,
    readonly from: Address
  ) {}

  /**
   * return empty instance of StateUpdate
   */
  public static default(): UnsignedTransaction {
    return new UnsignedTransaction(
      Address.default(),
      new Range(BigNumber.default(), BigNumber.default()),
      BigNumber.default(),
      new Property(Address.default(), []),
      Bytes.default(),
      Address.default()
    )
  }

  public static getParamType(): Struct {
    return new Struct([
      { key: 'depositContractAddress', value: Address.default() },
      { key: 'range', value: Range.getParamType() },
      { key: 'maxBlockNumber', value: BigNumber.default() },
      { key: 'stateObject', value: Property.getParamType() },
      { key: 'chunkId', value: Bytes.default() },
      { key: 'from', value: Address.default() }
    ])
  }

  public static fromStruct(struct: Struct): UnsignedTransaction {
    const depositContractAddress = struct.data[0].value as Address
    const range = struct.data[1].value as Struct
    const maxBlockNumber = struct.data[2].value as BigNumber
    const stateObject = struct.data[3].value as Struct
    const chunkId = struct.data[4].value as Bytes
    const from = struct.data[5].value as Address

    return new UnsignedTransaction(
      depositContractAddress,
      Range.fromStruct(range),
      maxBlockNumber,
      Property.fromStruct(stateObject),
      chunkId,
      from
    )
  }

  public toStruct(): Struct {
    return new Struct([
      { key: 'depositContractAddress', value: this.depositContractAddress },
      { key: 'range', value: this.range.toStruct() },
      { key: 'maxBlockNumber', value: this.maxBlockNumber },
      { key: 'stateObject', value: this.stateObject.toStruct() },
      { key: 'chunkId', value: this.chunkId },
      { key: 'from', value: this.from }
    ])
  }

  public async sign(signer: Wallet): Promise<SignedTransaction> {
    const signature = await signer.signMessage(
      ovmContext.coder.encode(this.toStruct())
    )

    return new SignedTransaction(
      this.depositContractAddress,
      this.range,
      this.maxBlockNumber,
      this.stateObject,
      this.chunkId,
      this.from,
      signature
    )
  }

  public getHash(): Bytes {
    return Keccak256.hash(ovmContext.coder.encode(this.toStruct()))
  }

  public toString(): string {
    return `UnsignedTransaction(depositContractAddress: ${
      this.depositContractAddress.raw
    }, maxBlockNumber: ${
      this.maxBlockNumber.raw
    }, range: ${this.range.toString()}, so: ${
      this.stateObject.deciderAddress.data
    }, chunkId: ${this.chunkId.toHexString()}, from: ${this.from.raw})`
  }

  public get message(): Bytes {
    return ovmContext.coder.encode(this.toStruct())
  }
}
