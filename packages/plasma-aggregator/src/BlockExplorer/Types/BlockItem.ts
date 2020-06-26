import { Block } from '@cryptoeconomicslab/plasma'

export interface BlockItem {
  blockNumber: string
  mainchainBlockNumber: string
  timestamp: number
  transactions: number
}

export function transformBlockItemFrom(block: Block): BlockItem {
  const transactions = Array.from(block.stateUpdatesMap.values()).reduce(
    (sum, stateUpdates) => sum + stateUpdates.length,
    0
  )
  return {
    blockNumber: block.blockNumber.raw,
    mainchainBlockNumber: block.mainchainBlockNumber.raw,
    timestamp: block.timestamp.data,
    transactions
  }
}

export function transformBlockListFrom(blocks: Block[]): BlockItem[] {
  return blocks.map(transformBlockItemFrom)
}
