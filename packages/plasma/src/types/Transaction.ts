import {
  Address,
  Bytes,
  Range,
  BigNumber,
  Struct,
  Property
} from '@cryptoeconomicslab/primitives'

export default interface Transaction {
  depositContractAddress: Address
  range: Range
  maxBlockNumber: BigNumber
  stateObject: Property
  from: Address
  message: Bytes
  toStruct(): Struct
  toString(): string
}
