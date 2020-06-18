import { BigNumber } from '@cryptoeconomicslab/primitives'
import { Block } from '@cryptoeconomicslab/plasma'
import Aggregator from '../Aggregator'
import { BlockItem, TransactionItem } from './Types'
import {
  transformBlockItemFrom,
  transformBlockListFrom
} from './Types/BlockItem'
import JSBI from 'jsbi'
import { transformTransactionItemFrom } from './Types/TransactionItem'

function isValidParam(bn: BigNumber): boolean {
  return JSBI.greaterThanOrEqual(bn.data, JSBI.BigInt(0))
}

function bnAdd(x: BigNumber, y: BigNumber): BigNumber {
  return BigNumber.from(JSBI.add(x.data, y.data))
}

function bnSub(x: BigNumber, y: BigNumber): BigNumber {
  return BigNumber.from(JSBI.subtract(x.data, y.data))
}

export default class BlockExplorerController {
  constructor(private aggregator: Aggregator) {}

  public async handleBlockList({
    from,
    to
  }: { from?: BigNumber; to?: BigNumber } = {}): Promise<BlockItem[]> {
    // Parameter validation
    if (from && !isValidParam(from)) throw new Error('Invalid Parameter')
    if (to && !isValidParam(to)) throw new Error('Invalid Parameter')
    const blockManager = this.aggregator['blockManager']

    const latestBlockNumber = await blockManager.getCurrentBlockNumber()

    const _to = to || latestBlockNumber
    let _from = from || bnSub(_to, BigNumber.from(9))
    if (!isValidParam(_from)) {
      _from = BigNumber.from(0)
    }

    const blocks: Block[] = []
    for (
      let n = _from;
      JSBI.lessThanOrEqual(n.data, _to.data);
      n = bnAdd(n, BigNumber.from(1))
    ) {
      const block = await blockManager.getBlock(n)
      if (!block) continue
      blocks.push(block)
    }
    return transformBlockListFrom(blocks)
  }

  public async handleBlock(blockNumber: BigNumber): Promise<BlockItem | null> {
    if (!isValidParam(blockNumber)) throw new Error('Invalid Parameter')

    const b = await this.aggregator['blockManager'].getBlock(blockNumber)
    return b ? transformBlockItemFrom(b) : null
  }

  public async handleTransactionList(
    blockNumber: BigNumber
  ): Promise<TransactionItem[]> {
    // Parameter validation
    if (!isValidParam(blockNumber)) throw new Error('Invalid Parameter')
    const blockManager = this.aggregator['blockManager']
    const latestBlockNumber = await blockManager.getCurrentBlockNumber()
    if (JSBI.greaterThan(blockNumber.data, latestBlockNumber.data))
      throw new Error('Invalid Parameter')

    const block = await blockManager.getBlock(blockNumber)
    if (!block) throw new Error('Unexpected error: Block not found')
    return Array.from(block.stateUpdatesMap.values())
      .reduce((prev, current) => prev.concat(current), [])
      .map(su => transformTransactionItemFrom(su, block))
  }

  public async handleTransaction(): Promise<TransactionItem | null> {
    return null
  }
}
