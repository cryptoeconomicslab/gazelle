import { Address, List, Struct, Bytes } from './'

export default class Property {
  public deciderAddress: Address
  public inputs: Bytes[]

  constructor(deciderAddress: Address, inputs: Bytes[]) {
    this.deciderAddress = deciderAddress
    this.inputs = inputs
  }
  public toStruct(): Struct {
    return new Struct([
      {
        key: 'deciderAddress',
        value: this.deciderAddress
      },
      { key: 'inputs', value: new List(Bytes, this.inputs) }
    ])
  }

  public static getParamType(): Struct {
    return Struct.from([
      {
        key: 'deciderAddress',
        value: Address.default()
      },
      { key: 'inputs', value: List.default(Bytes, Bytes.default()) }
    ])
  }

  public static fromStruct(_struct: Struct): Property {
    return new Property(
      _struct.data[0].value as Address,
      (_struct.data[1].value as List<Bytes>).data
    )
  }
}
