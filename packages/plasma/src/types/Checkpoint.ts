import {
  Address,
  Bytes,
  Struct,
  Property
} from '@cryptoeconomicslab/primitives'
import { decodeStructable } from '@cryptoeconomicslab/coder'

export default class Checkpoint {
  constructor(public deciderAddress: Address, public stateUpdate: Property) {}

  public static default(): Checkpoint {
    return new Checkpoint(
      Address.default(),
      new Property(Address.default(), [])
    )
  }

  public static getParamType(): Struct {
    return new Struct([
      { key: 'deciderAddress', value: Address.default() },
      { key: 'stateUpdate', value: Property.getParamType() }
    ])
  }

  public static fromStruct(struct: Struct): Checkpoint {
    return new Checkpoint(
      struct.data[0].value as Address,
      Property.fromStruct(struct.data[1].value as Struct)
    )
  }

  public static fromProperty(property: Property) {
    return new Checkpoint(
      property.deciderAddress,
      decodeStructable(Property, ovmContext.coder, property.inputs[0])
    )
  }

  public get property(): Property {
    const { coder } = ovmContext
    return new Property(this.deciderAddress, [
      coder.encode(this.stateUpdate.toStruct())
    ])
  }

  public toStruct(): Struct {
    return new Struct([
      { key: 'deciderAddress', value: this.deciderAddress },
      { key: 'stateUpdate', value: this.stateUpdate.toStruct() }
    ])
  }

  // TODO: implement calculate checkpoint id
  public getId(): Bytes {
    return Bytes.default()
  }
}
