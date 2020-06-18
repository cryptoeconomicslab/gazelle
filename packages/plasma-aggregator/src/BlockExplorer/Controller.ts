import { BigNumber } from '@cryptoeconomicslab/primitives'
import Aggregator from '../Aggregator'
import {
  BlockItem,
  TransactionListItem,
  TransactionDetailedItem
} from './Types'
import { transformBlockItemFrom } from './Types/BlockItem'

export default class BlockExplorerController {
  constructor(private aggregator: Aggregator) {}

  public async handleBlockList(): Promise<BlockItem[]> {
    return []
  }

  public async handleBlock(blockNumber: BigNumber): Promise<BlockItem | null> {
    const b = await this.aggregator['blockManager'].getBlock(blockNumber)
    return b ? transformBlockItemFrom(b) : null
  }

  public async handleTransactionList(): Promise<TransactionListItem[]> {
    return []
  }

  public async handleTransaction(): Promise<TransactionDetailedItem | null> {
    return null
  }
}
