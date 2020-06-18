import BlockExplorerController from '../../src/BlockExplorer/Controller'
import { Block, StateUpdate } from '@cryptoeconomicslab/plasma'
import {
  Address,
  Bytes,
  BigNumber,
  Range
} from '@cryptoeconomicslab/primitives'
import { Property } from '@cryptoeconomicslab/ovm'
import Coder from '@cryptoeconomicslab/coder'
import { setupContext } from '@cryptoeconomicslab/context'
setupContext({ coder: Coder })
import Aggregator from '../../src/Aggregator'
import { initializeAggregatorWithBlocks } from './helper'

const testAddr = '0x0000000000000000000000000000000000000001'
const testAddr2 = '0x0000000000000000000000000000000000000002'

const su = (bn: number, start: number, end: number, msg: string) =>
  new StateUpdate(
    Address.default(),
    Address.default(),
    new Range(BigNumber.from(start), BigNumber.from(end)),
    BigNumber.from(bn),
    new Property(Address.default(), [Bytes.fromString(msg)])
  )

const block = (bn: number, addr: string, sus: StateUpdate[]) => {
  const map = new Map()
  map.set(addr, sus)
  return new Block(BigNumber.from(bn), map)
}

describe('BlockExplorerController', () => {
  let aggregator: Aggregator
  beforeEach(async () => {
    const blocks = [
      block(1, testAddr, [
        su(1, 0, 10, 'hi'),
        su(1, 10, 20, 'hello'),
        su(1, 30, 35, 'hey')
      ])
    ]
    aggregator = await initializeAggregatorWithBlocks(blocks)
  })

  describe('handleBlock', () => {
    test('returns block correctly', async () => {
      const controller = new BlockExplorerController(aggregator)
      const b = await controller.handleBlock(BigNumber.from(1))
      expect(b).toEqual({
        blockNumber: '1',
        transactions: 3
      })
    })

    test('returns null for too large block number', async () => {
      const controller = new BlockExplorerController(aggregator)
      const b = await controller.handleBlock(BigNumber.from(10))
      expect(b).toBeNull()
    })
  })
})
