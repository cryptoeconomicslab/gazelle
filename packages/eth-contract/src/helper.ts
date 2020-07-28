import {
  Address,
  Range,
  BigNumber,
  Property,
  Bytes,
  FixedBytes
} from '@cryptoeconomicslab/primitives'
import {
  StateUpdate,
  Transaction,
  ExitChallenge,
  EXIT_CHALLENGE_TYPE
} from '@cryptoeconomicslab/plasma'
import {
  DoubleLayerInclusionProof,
  IntervalTreeInclusionProof,
  AddressTreeInclusionProof,
  AddressTreeNode,
  IntervalTreeNode
} from '@cryptoeconomicslab/merkle-tree'

export function logToStateUpdate(value: any): StateUpdate {
  const stateObject = new Property(
    Address.from(value[3][0]),
    value[3][1].map((i: string) => Bytes.fromHexString(i))
  )

  return new StateUpdate(
    Address.from(value[0]),
    new Range(
      BigNumber.fromString(value[1][0].toString()),
      BigNumber.fromString(value[1][1].toString())
    ),
    BigNumber.fromString(value[2].toString()),
    stateObject
  )
}

export function logToTransaction(value: any): Transaction {
  const stateObject = new Property(
    Address.from(value[3][0]),
    value[3][1].map((i: string) => Bytes.fromHexString(i))
  )

  return new Transaction(
    Address.from(value[0]),
    new Range(
      BigNumber.fromString(value[1][0].toString()),
      BigNumber.fromString(value[1][1].toString())
    ),
    BigNumber.fromString(value[2].toString()),
    stateObject,
    Address.from(value[5])
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

export function logToExitChallenge(log: any): ExitChallenge {
  // TODO: implement
  return {
    type: EXIT_CHALLENGE_TYPE.SPENT,
    stateUpdate: logToStateUpdate(log[0]),
    transaction: logToTransaction(log[1]),
    witness: []
  }
}
