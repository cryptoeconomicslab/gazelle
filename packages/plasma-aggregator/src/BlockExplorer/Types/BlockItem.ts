import { Block } from '@cryptoeconomicslab/plasma'

export interface BlockItem {
  blockNumber: string
  // TODO: timestamp: Date
  transactions: number
}

export function transformBlockItemFrom(block: Block): BlockItem {
  const transactions = Array.from(block.stateUpdatesMap.values()).reduce(
    (sum, stateUpdates) => sum + stateUpdates.length,
    0
  )
  return {
    blockNumber: block.blockNumber.raw,
    transactions
  }
}

export function transformBlockListFrom(blocks: Block[]): BlockItem[] {
  return blocks.map(transformBlockItemFrom)
}
