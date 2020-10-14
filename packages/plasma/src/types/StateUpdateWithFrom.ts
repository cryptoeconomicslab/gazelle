import {
  Address,
  Bytes,
  BigNumber,
  Range,
  Property,
  Struct,
  FixedBytes
} from '@cryptoeconomicslab/primitives'
import { decodeStructable } from '@cryptoeconomicslab/coder'
import { RangeRecord } from '@cryptoeconomicslab/db'
import StateUpdateWithFromRecord from './StateUpdateWithFromRecord'

import { Keccak256 } from '@cryptoeconomicslab/hash'
import JSBI from 'jsbi'
import { StateUpdate } from '.'

/**
 * StateUpdate wrapper class
 * StateUpdate is a property with inputs type
 * [tokenAddress: Address, range: Range, block_number: uint256, stateObject: Property]
 */
export default class StateUpdateWithFrom {
  constructor(
    public depositContractAddress: Address,
    public range: Range,
    public blockNumber: BigNumber,
    public stateObject: Property,
    public chunkId: FixedBytes,
    public from: Address
  ) {}

  public get amount(): JSBI {
    return JSBI.subtract(this.range.end.data, this.range.start.data)
  }

  public update({
    depositContractAddress,
    range,
    blockNumber,
    stateObject,
    chunkId,
    from
  }: {
    depositContractAddress?: Address
    range?: Range
    blockNumber?: BigNumber
    stateObject?: Property
    chunkId?: FixedBytes
    from?: Address
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
    if (from) {
      this.from = from
    }
  }

  public static fromRangeRecord(r: RangeRecord): StateUpdateWithFrom {
    return StateUpdateWithFrom.fromRecord(
      decodeStructable(StateUpdateWithFromRecord, ovmContext.coder, r.value),
      new Range(r.start, r.end)
    )
  }

  public static fromRecord(
    record: StateUpdateWithFromRecord,
    range: Range
  ): StateUpdateWithFrom {
    return new StateUpdateWithFrom(
      record.depositContractAddress,
      range,
      record.blockNumber,
      record.stateObject,
      record.chunkId,
      record.from
    )
  }

  public get hash(): Bytes {
    return Keccak256.hash(ovmContext.coder.encode(this.toStruct()))
  }

  public toRecord(): StateUpdateWithFromRecord {
    return new StateUpdateWithFromRecord(
      this.depositContractAddress,
      this.blockNumber,
      this.stateObject,
      this.chunkId,
      this.from
    )
  }

  public toString(): string {
    return `StateUpdate(depositContractAddress: ${this.depositContractAddress.toString()}, blockNumber: ${this.blockNumber.toString()}, range: ${this.range.toString()}, so: ${
      this.stateObject.deciderAddress.data
    }, chunkId: ${this.chunkId.toHexString()}, from: ${this.from.data})`
  }

  public static getParamType(): Struct {
    return new Struct([
      { key: 'depositContractAddress', value: Address.default() },
      { key: 'range', value: Range.getParamType() },
      { key: 'blockNumber', value: BigNumber.default() },
      { key: 'stateObject', value: Property.getParamType() },
      { key: 'chunkId', value: FixedBytes.default(32) },
      { key: 'from', value: Address.default() }
    ])
  }

  public static fromStruct(struct: Struct): StateUpdateWithFrom {
    const depositContractAddress = struct.data[0].value as Address
    const range = struct.data[1].value as Struct
    const blockNumber = struct.data[2].value as BigNumber
    const stateObject = struct.data[3].value as Struct
    const chunkId = struct.data[4].value as FixedBytes
    const from = struct.data[5].value as Address

    return new StateUpdateWithFrom(
      depositContractAddress,
      Range.fromStruct(range),
      blockNumber,
      Property.fromStruct(stateObject),
      chunkId,
      from
    )
  }

  public toStruct(): Struct {
    return new Struct([
      { key: 'depositContractAddress', value: this.depositContractAddress },
      { key: 'range', value: this.range.toStruct() },
      { key: 'blockNumber', value: this.blockNumber },
      { key: 'stateObject', value: this.stateObject.toStruct() },
      { key: 'chunkId', value: this.chunkId },
      { key: 'from', value: this.from }
    ])
  }

  public toStateUpdate(): StateUpdate {
    return new StateUpdate(
      this.depositContractAddress,
      this.range,
      this.blockNumber,
      this.stateObject,
      this.chunkId
    )
  }
}
