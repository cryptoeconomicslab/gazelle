import { Block } from '@cryptoeconomicslab/plasma'

export interface BlockItem {
  blockNumber: string
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
    timestamp: block.timestamp,
    transactions
  }
}

export function transformBlockListFrom(blocks: Block[]): BlockItem[] {
  return blocks.map(transformBlockItemFrom)
}
