import { Block, StateUpdate } from '@cryptoeconomicslab/plasma'

interface StateObject {
  address: string
  parameter: string[]
}

export interface TransactionItem {
  hash: string
  //   from: string
  blockNumber: string
  mainchainBlockNumber: string
  timestamp: number
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
    blockNumber: block.blockNumber.raw,
    mainchainBlockNumber: block.mainchainBlockNumber.raw,
    timestamp: block.timestamp.data,
    depositContractAddress: su.depositContractAddress.data,
    range: {
      start: su.range.start.raw,
      end: su.range.end.raw
    },
    stateObject: so
  }
}
