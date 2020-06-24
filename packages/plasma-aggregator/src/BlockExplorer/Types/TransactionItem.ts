import { Block, StateUpdate } from '@cryptoeconomicslab/plasma'

interface StateObject {
  address: string
  parameter: string[]
}

export interface TransactionItem {
  hash: string
  //   from: string
  timestamp: number
  blockNumber: string
  depositContractAddress: string
  stateObject: StateObject
  range: { start: string; end: string }
}

export function transformTransactionItemFrom(
  su: StateUpdate,
  block: Block
): TransactionItem {
  const so = {
    address: su.stateObject.deciderAddress.data,
    parameter: su.stateObject.inputs.map(i => i.toHexString())
  }
  return {
    hash: su.hash.toHexString(),
    //    from: transaction.from.toString(),
    timestamp: block.timestamp,
    blockNumber: block.blockNumber.raw,
    depositContractAddress: su.depositContractAddress.data,
    range: {
      start: su.range.start.raw,
      end: su.range.end.raw
    },
    stateObject: so
  }
}
