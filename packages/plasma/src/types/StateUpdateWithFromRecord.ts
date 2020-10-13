import {
  Address,
  Struct,
  BigNumber,
  Property,
  FixedBytes
} from '@cryptoeconomicslab/primitives'

export default class StateUpdateWithFromRecord {
  constructor(
    readonly depositContractAddress: Address,
    readonly blockNumber: BigNumber,
    readonly stateObject: Property,
    readonly chunkId: FixedBytes,
    readonly from: Address
  ) {}

  public static default(): StateUpdateWithFromRecord {
    return new StateUpdateWithFromRecord(
      Address.default(),
      BigNumber.default(),
      new Property(Address.default(), []),
      FixedBytes.default(32),
      Address.default()
    )
  }

  public static getParamType(): Struct {
    return new Struct([
      { key: 'depositContractAddress', value: Address.default() },
      { key: 'blockNumber', value: BigNumber.default() },
      { key: 'stateObject', value: Property.getParamType() },
      { key: 'chunkId', value: FixedBytes.default(32) },
      { key: 'from', value: Address.default() }
    ])
  }

  public static fromStruct(struct: Struct): StateUpdateWithFromRecord {
    return new StateUpdateWithFromRecord(
      struct.data[0].value as Address,
      struct.data[1].value as BigNumber,
      Property.fromStruct(struct.data[2].value as Struct),
      struct.data[3].value as FixedBytes,
      struct.data[4].value as Address
    )
  }

  public toStruct(): Struct {
    return new Struct([
      { key: 'depositContractAddress', value: this.depositContractAddress },
      { key: 'blockNumber', value: this.blockNumber },
      { key: 'stateObject', value: this.stateObject.toStruct() },
      { key: 'chunkId', value: this.chunkId },
      { key: 'from', value: this.from }
    ])
  }
}
