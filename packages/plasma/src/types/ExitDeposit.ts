import StateUpdate from './StateUpdate'
import { Bytes, Address, Range, Property } from '@cryptoeconomicslab/primitives'
import { decodeStructable } from '@cryptoeconomicslab/coder'
import { Keccak256 } from '@cryptoeconomicslab/hash'
import IExit from './IExit'

export default class ExitDeposit implements IExit {
  constructor(
    readonly exitDepositPredicateAddress: Address,
    readonly stateUpdate: StateUpdate,
    readonly checkpoint: StateUpdate,
    readonly id: Bytes
  ) {}

  public get property(): Property {
    const { encode } = ovmContext.coder
    return new Property(this.exitDepositPredicateAddress, [
      encode(this.stateUpdate.property.toStruct()),
      encode(this.checkpoint.property.toStruct())
    ])
  }

  public static fromProperty(property: Property): ExitDeposit {
    const { coder } = ovmContext
    const stateUpdate = StateUpdate.fromProperty(
      decodeStructable(Property, coder, property.inputs[0])
    )
    const checkpoint = StateUpdate.fromProperty(
      decodeStructable(Property, coder, property.inputs[1])
    )
    const id = Keccak256.hash(coder.encode(property.toStruct()))
    return new ExitDeposit(property.deciderAddress, stateUpdate, checkpoint, id)
  }

  public get range(): Range {
    return this.stateUpdate.range
  }
}
