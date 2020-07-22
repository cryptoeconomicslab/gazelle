import {
  Address,
  Bytes,
  BigNumber,
  Range,
  Property
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
    public deciderAddress: Address,
    public depositContractAddress: Address,
    public range: Range,
    public blockNumber: BigNumber,
    public stateObject: Property
  ) {}

  public get amount(): JSBI {
    return JSBI.subtract(this.range.end.data, this.range.start.data)
  }

  public get predicateAddress(): Address {
    return this.property.deciderAddress
  }

  public get property(): Property {
    const { coder } = ovmContext
    return new Property(this.deciderAddress, [
      coder.encode(this.depositContractAddress),
      coder.encode(this.range.toStruct()),
      coder.encode(this.blockNumber),
      coder.encode(this.stateObject.toStruct())
    ])
  }

  public update({
    depositContractAddress,
    range,
    blockNumber,
    stateObject
  }: {
    depositContractAddress?: Address
    range?: Range
    blockNumber?: BigNumber
    stateObject?: Property
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
  }

  public static fromProperty(property: Property) {
    return new StateUpdate(
      property.deciderAddress,
      ovmContext.coder.decode(Address.default(), property.inputs[0]),
      decodeStructable(Range, ovmContext.coder, property.inputs[1]),
      ovmContext.coder.decode(BigNumber.default(), property.inputs[2]),
      decodeStructable(Property, ovmContext.coder, property.inputs[3])
    )
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
    const inputs: Bytes[] = [
      record.depositContractAddress,
      range.toStruct(),
      record.blockNumber,
      record.stateObject.toStruct()
    ].map(ovmContext.coder.encode)

    const property = new Property(record.predicateAddress, inputs)

    return StateUpdate.fromProperty(property)
  }

  public get hash(): Bytes {
    return Keccak256.hash(ovmContext.coder.encode(this.property.toStruct()))
  }

  public toRecord(): StateUpdateRecord {
    return new StateUpdateRecord(
      this.deciderAddress,
      this.depositContractAddress,
      this.blockNumber,
      this.stateObject
    )
  }

  public toString(): string {
    return `StateUpdate(depositContractAddress: ${this.depositContractAddress.toString()}, blockNumber: ${this.blockNumber.toString()}, range: ${this.range.toString()}, so: ${
      this.stateObject.deciderAddress.data
    })`
  }
}
