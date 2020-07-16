import { Struct, Property, BigNumber } from '@cryptoeconomicslab/primitives'
import { StateUpdate } from '.'

export default class Checkpoint {
  constructor(
    readonly stateUpdate: StateUpdate,
    readonly claimedBlockNumber: BigNumber
  ) {}

  public static fromStruct(struct: Struct): Checkpoint {
    return new Checkpoint(
      StateUpdate.fromProperty(
        Property.fromStruct(struct.data[0].value as Struct)
      ),
      struct.data[1].value as BigNumber
    )
  }

  public toStruct(): Struct {
    return new Struct([
      { key: 'stateUpdate', value: this.stateUpdate.property.toStruct() },
      { key: 'claimedBlockNumber', value: this.claimedBlockNumber }
    ])
  }

  static getParamType(): Struct {
    return new Struct([
      { key: 'stateUpdate', value: Property.getParamType() },
      { key: 'claimedBlockNumber', value: BigNumber.default() }
    ])
  }
}
