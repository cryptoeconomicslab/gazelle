import * as ethers from 'ethers'
import {
  Address,
  Range,
  BigNumber,
  Property,
  Bytes,
  FixedBytes
} from '@cryptoeconomicslab/primitives'
import { StateUpdate, SignedTransaction } from '@cryptoeconomicslab/plasma'
import {
  DoubleLayerInclusionProof,
  IntervalTreeInclusionProof,
  AddressTreeInclusionProof,
  AddressTreeNode,
  IntervalTreeNode
} from '@cryptoeconomicslab/merkle-tree'

export function logToRange(value: any): Range {
  return new Range(
    BigNumber.fromString(value[0].toString()),
    BigNumber.fromString(value[1].toString())
  )
}

export function logToStateUpdate(value: any): StateUpdate {
  const stateObject = new Property(
    Address.from(value[3][0]),
    value[3][1].map((i: string) => Bytes.fromHexString(i))
  )

  return new StateUpdate(
    Address.from(value[0]),
    logToRange(value[1]),
    BigNumber.fromString(value[2].toString()),
    stateObject,
    FixedBytes.fromHexString(32, value[4])
  )
}

export function logToSignedTransaction(value: any): SignedTransaction {
  const stateObject = new Property(
    Address.from(value[3][0]),
    value[3][1].map((i: string) => Bytes.fromHexString(i))
  )

  return new SignedTransaction(
    Address.from(value[0]),
    logToRange(value[1]),
    BigNumber.fromString(value[2].toString()),
    stateObject,
    FixedBytes.fromHexString(32, value[4]),
    Address.from(value[5]),
    Bytes.fromHexString(value[6])
  )
}

export function logToInclusionProof(value: any): DoubleLayerInclusionProof {
  const addressProof = new AddressTreeInclusionProof(
    Address.from(value[0][0]),
    Number(value[0][1].toString()),
    value[0][2].map(
      ([data, tokenAddr]) =>
        new AddressTreeNode(
          Address.from(tokenAddr),
          FixedBytes.fromHexString(32, data)
        )
    )
  )
  const intervalProof = new IntervalTreeInclusionProof(
    BigNumber.fromString(value[0][0].toString()),
    Number(value[0][1].toString()),
    value[0][2].map(
      ([data, start]) =>
        new IntervalTreeNode(
          BigNumber.fromString(start.toString()),
          FixedBytes.fromHexString(32, data)
        )
    )
  )

  return new DoubleLayerInclusionProof(intervalProof, addressProof)
}

export function propertyToLog(property: Property) {
  return [
    property.deciderAddress.data,
    property.inputs.map(i => i.toHexString())
  ]
}

export function rangeToLog(range: Range) {
  return [
    ethers.utils.bigNumberify(range.start.raw),
    ethers.utils.bigNumberify(range.end.raw)
  ]
}

export function stateUpdateToLog(stateUpdate: StateUpdate) {
  return [
    stateUpdate.depositContractAddress.data,
    rangeToLog(stateUpdate.range),
    ethers.utils.bigNumberify(stateUpdate.blockNumber.raw),
    propertyToLog(stateUpdate.stateObject),
    stateUpdate.chunkId.toHexString()
  ]
}
