import {
  Address,
  Struct,
  BigNumber,
  Property,
  FixedBytes
} from '@cryptoeconomicslab/primitives'

export default class StateUpdateRecord {
  constructor(
    readonly depositContractAddress: Address,
    readonly blockNumber: BigNumber,
    readonly stateObject: Property,
    readonly chunkId: FixedBytes
  ) {}

  /**
   * return empty instance of Transaction
   */
  public static default(): StateUpdateRecord {
    return new StateUpdateRecord(
      Address.default(),
      BigNumber.default(),
      new Property(Address.default(), []),
      FixedBytes.default(32)
    )
  }

  public static getParamType(): Struct {
    return new Struct([
      { key: 'depositContractAddress', value: Address.default() },
      { key: 'blockNumber', value: BigNumber.default() },
      { key: 'stateObject', value: Property.getParamType() },
      { key: 'chunkId', value: FixedBytes.default(32) }
    ])
  }

  public static fromStruct(struct: Struct): StateUpdateRecord {
    return new StateUpdateRecord(
      struct.data[0].value as Address,
      struct.data[1].value as BigNumber,
      Property.fromStruct(struct.data[2].value as Struct),
      struct.data[3].value as FixedBytes
    )
  }

  public toStruct(): Struct {
    return new Struct([
      { key: 'depositContractAddress', value: this.depositContractAddress },
      { key: 'blockNumber', value: this.blockNumber },
      { key: 'stateObject', value: this.stateObject.toStruct() },
      { key: 'chunkId', value: this.chunkId }
    ])
  }
}
