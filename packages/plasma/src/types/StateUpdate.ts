import {
  Address,
  Bytes,
  BigNumber,
  Range,
  Property,
  Struct
} from '@cryptoeconomicslab/primitives'
import { decodeStructable } from '@cryptoeconomicslab/coder'
import { RangeRecord } from '@cryptoeconomicslab/db'
import StateUpdateRecord from './StateUpdateRecord'
import { Keccak256 } from '@cryptoeconomicslab/hash'
import JSBI from 'jsbi'

/**
 * StateUpdate wrapper class
 * StateUpdate is a property with inputs type
 * [tokenAddress: Address, range: Range, block_number: uint256, stateObject: Property]
 */
export default class StateUpdate {
  constructor(
    public depositContractAddress: Address,
    public range: Range,
    public blockNumber: BigNumber,
    public stateObject: Property,
    public chunkId: Bytes
  ) {}

  public get amount(): JSBI {
    return JSBI.subtract(this.range.end.data, this.range.start.data)
  }

  public update({
    depositContractAddress,
    range,
    blockNumber,
    stateObject,
    chunkId
  }: {
    depositContractAddress?: Address
    range?: Range
    blockNumber?: BigNumber
    stateObject?: Property
    chunkId?: Bytes
  }) {
    if (depositContractAddress) {
      this.depositContractAddress = depositContractAddress
    }
    if (range) {
      this.range = range
    }
    if (blockNumber) {
      this.blockNumber = blockNumber
    }
    if (stateObject) {
      this.stateObject = stateObject
    }
    if (chunkId) {
      this.chunkId = chunkId
    }
  }

  public static fromRangeRecord(r: RangeRecord): StateUpdate {
    return StateUpdate.fromRecord(
      decodeStructable(StateUpdateRecord, ovmContext.coder, r.value),
      new Range(r.start, r.end)
    )
  }

  public static fromRecord(
    record: StateUpdateRecord,
    range: Range
  ): StateUpdate {
    return new StateUpdate(
      record.depositContractAddress,
      range,
      record.blockNumber,
      record.stateObject,
      record.chunkId
    )
  }

  public get hash(): Bytes {
    return Keccak256.hash(ovmContext.coder.encode(this.toStruct()))
  }

  public toRecord(): StateUpdateRecord {
    return new StateUpdateRecord(
      this.depositContractAddress,
      this.blockNumber,
      this.stateObject,
      this.chunkId
    )
  }

  public toString(): string {
    return `StateUpdate(depositContractAddress: ${this.depositContractAddress.toString()}, blockNumber: ${this.blockNumber.toString()}, range: ${this.range.toString()}, so: ${
      this.stateObject.deciderAddress.data
    }, chunkId: ${this.chunkId.toHexString()})`
  }

  public static getParamType(): Struct {
    return new Struct([
      { key: 'depositContractAddress', value: Address.default() },
      { key: 'range', value: Range.getParamType() },
      { key: 'blockNumber', value: BigNumber.default() },
      { key: 'stateObject', value: Property.getParamType() },
      { key: 'chunkId', value: Bytes.default() }
    ])
  }

  public static fromStruct(struct: Struct): StateUpdate {
    const depositContractAddress = struct.data[0].value as Address
    const range = struct.data[1].value as Struct
    const blockNumber = struct.data[2].value as BigNumber
    const stateObject = struct.data[3].value as Struct
    const chunkId = struct.data[4].value as Bytes

    return new StateUpdate(
      depositContractAddress,
      Range.fromStruct(range),
      blockNumber,
      Property.fromStruct(stateObject),
      chunkId
    )
  }

  public toStruct(): Struct {
    return new Struct([
      { key: 'depositContractAddress', value: this.depositContractAddress },
      { key: 'range', value: this.range.toStruct() },
      { key: 'blockNumber', value: this.blockNumber },
      { key: 'stateObject', value: this.stateObject.toStruct() },
      { key: 'chunkId', value: this.chunkId }
    ])
  }
}
