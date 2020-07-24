import { Struct, BigNumber } from '@cryptoeconomicslab/primitives'
import { StateUpdate } from '.'

export default class Exit {
  constructor(
    readonly stateUpdate: StateUpdate,
    readonly claimedBlockNumber: BigNumber
  ) {}

  public static fromStruct(struct: Struct): Exit {
    return new Exit(
      StateUpdate.fromStruct(struct.data[0].value as Struct),
      struct.data[1].value as BigNumber
    )
  }

  public toStruct(): Struct {
    return new Struct([
      { key: 'stateUpdate', value: this.stateUpdate.toStruct() },
      { key: 'claimedBlockNumber', value: this.claimedBlockNumber }
    ])
  }

  static getParamType(): Struct {
    return new Struct([
      { key: 'stateUpdate', value: StateUpdate.getParamType() },
      { key: 'claimedBlockNumber', value: BigNumber.default() }
    ])
  }
}
