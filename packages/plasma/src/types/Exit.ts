import StateUpdate from './StateUpdate'
import { DoubleLayerInclusionProof } from '@cryptoeconomicslab/merkle-tree'
import { Bytes, Address, Range, Property } from '@cryptoeconomicslab/primitives'
import { decodeStructable } from '@cryptoeconomicslab/coder'
import { Keccak256 } from '@cryptoeconomicslab/hash'
import IExit from './IExit'

export default class Exit implements IExit {
  constructor(
    readonly exitPredicateAddress: Address,
    readonly stateUpdate: StateUpdate,
    readonly inclusionProof: DoubleLayerInclusionProof,
    readonly id: Bytes
  ) {}

  public get property(): Property {
    const { encode } = ovmContext.coder
    return new Property(this.exitPredicateAddress, [
      encode(this.stateUpdate.property.toStruct()),
      encode(this.inclusionProof.toStruct())
    ])
  }

  public static fromProperty(property: Property): Exit {
    const { coder } = ovmContext
    const stateUpdate = StateUpdate.fromProperty(
      decodeStructable(Property, coder, property.inputs[0])
    )
    const inclusionProof = decodeStructable(
      DoubleLayerInclusionProof,
      coder,
      property.inputs[1]
    )
    const id = Keccak256.hash(coder.encode(property.toStruct()))
    return new Exit(property.deciderAddress, stateUpdate, inclusionProof, id)
  }

  public get range(): Range {
    return this.stateUpdate.range
  }
}
