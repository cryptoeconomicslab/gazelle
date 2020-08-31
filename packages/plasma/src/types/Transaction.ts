import {
  Address,
  Bytes,
  Range,
  BigNumber,
  Struct,
  Property,
  FixedBytes
} from '@cryptoeconomicslab/primitives'

export default interface Transaction {
  depositContractAddress: Address
  range: Range
  maxBlockNumber: BigNumber
  stateObject: Property
  from: Address
  message: Bytes
  chunkId: FixedBytes
  toStruct(): Struct
  toString(): string
}
