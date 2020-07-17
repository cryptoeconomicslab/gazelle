import {
  Address,
  Range,
  BigNumber,
  Bytes,
  Struct,
  Property
} from '@cryptoeconomicslab/primitives'
import { Keccak256 } from '@cryptoeconomicslab/hash'

export default class Transaction {
  constructor(
    public depositContractAddress: Address,
    public range: Range,
    public maxBlockNumber: BigNumber,
    public stateObject: Property,
    public from: Address,
    public signature: Bytes = Bytes.default()
  ) {}

  /**
   * return empty instance of StateUpdate
   */
  public static default(): Transaction {
    return new Transaction(
      Address.default(),
      new Range(BigNumber.default(), BigNumber.default()),
      BigNumber.default(),
      new Property(Address.default(), []),
      Address.default(),
      Bytes.default()
    )
  }

  public static getParamType(): Struct {
    return new Struct([
      { key: 'depositContractAddress', value: Address.default() },
      { key: 'range', value: Range.getParamType() },
      { key: 'maxBlockNumber', value: BigNumber.default() },
      { key: 'stateObject', value: Property.getParamType() },
      { key: 'from', value: Address.default() },
      { key: 'signature', value: Bytes.default() }
    ])
  }

  public static fromStruct(struct: Struct): Transaction {
    const depositContractAddress = struct.data[0].value as Address
    const range = struct.data[1].value as Struct
    const maxBlockNumber = struct.data[2].value as BigNumber
    const stateObject = struct.data[3].value as Struct
    const from = struct.data[4].value as Address
    const signature = struct.data[5].value as Bytes

    return new Transaction(
      depositContractAddress as Address,
      Range.fromStruct(range as Struct),
      maxBlockNumber,
      Property.fromStruct(stateObject as Struct),
      from as Address,
      signature as Bytes
    )
  }

  public static fromProperty(property: Property): Transaction {
    const depositContractAddress = ovmContext.coder.decode(
      Address.default(),
      property.inputs[0]
    )
    const range = Range.fromStruct(
      ovmContext.coder.decode(Range.getParamType(), property.inputs[1])
    )
    const maxBlockNumber = ovmContext.coder.decode(
      BigNumber.default(),
      property.inputs[2]
    )
    const stateObject = Property.fromStruct(
      ovmContext.coder.decode(Property.getParamType(), property.inputs[3])
    )
    return new Transaction(
      depositContractAddress,
      range,
      maxBlockNumber,
      stateObject,
      Address.default(),
      Bytes.default()
    )
  }

  public toStruct(): Struct {
    return new Struct([
      { key: 'depositContractAddress', value: this.depositContractAddress },
      { key: 'range', value: this.range.toStruct() },
      { key: 'maxBlockNumber', value: this.maxBlockNumber },
      { key: 'stateObject', value: this.stateObject.toStruct() },
      { key: 'from', value: this.from },
      { key: 'signature', value: this.signature }
    ])
  }

  public get body(): Struct {
    return new Struct([
      { key: 'depositContractAddress', value: this.depositContractAddress },
      { key: 'range', value: this.range.toStruct() },
      { key: 'maxBlockNumber', value: this.maxBlockNumber },
      { key: 'stateObject', value: this.stateObject.toStruct() },
      { key: 'from', value: this.from }
    ])
  }

  public getHash(): Bytes {
    return Keccak256.hash(ovmContext.coder.encode(this.body))
  }

  public toProperty(deciderAddress: Address): Property {
    return new Property(deciderAddress, [
      ovmContext.coder.encode(this.depositContractAddress),
      ovmContext.coder.encode(this.range.toStruct()),
      ovmContext.coder.encode(this.maxBlockNumber),
      ovmContext.coder.encode(this.stateObject.toStruct())
    ])
  }
}
