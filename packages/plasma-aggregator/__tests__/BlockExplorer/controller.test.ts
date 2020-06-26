import BlockExplorerController from '../../src/BlockExplorer/controller'
import { Block, StateUpdate } from '@cryptoeconomicslab/plasma'
import {
  Address,
  Bytes,
  BigNumber,
  Integer,
  Range
} from '@cryptoeconomicslab/primitives'
import { Property } from '@cryptoeconomicslab/ovm'
import Coder from '@cryptoeconomicslab/coder'
import { setupContext } from '@cryptoeconomicslab/context'
import { DateUtils } from '@cryptoeconomicslab/utils'
setupContext({ coder: Coder })
import { initializeAggregatorWithBlocks } from './helper'
import { BlockManager, StateManager } from '../../src/managers'

const testAddr = '0x0000000000000000000000000000000000000001'

// for test data generation
const su = (bn: number, start: number, end: number) => {
  return new StateUpdate(
    Address.default(),
    Address.default(),
    new Range(BigNumber.from(start), BigNumber.from(end)),
    BigNumber.from(bn),
    new Property(Address.default(), [Bytes.fromHexString(testAddr)])
  )
}
const TIME_STAMP = DateUtils.getCurrentDate()

const block = (bn: number, addr: string, sus: StateUpdate[]) => {
  const map = new Map()
  map.set(addr, sus)
  return new Block(
    BigNumber.from(bn),
    map,
    BigNumber.from(0),
    Integer.from(TIME_STAMP)
  )
}

describe('BlockExplorerController', () => {
  let blockManager: BlockManager, stateManager: StateManager
  beforeAll(async () => {
    new Array(12)
    const blocks = [
      block(1, testAddr, [su(1, 0, 10), su(1, 10, 20), su(1, 30, 35)])
    ].concat(
      Array(12)
        .fill(0)
        .map((v, i) => block(i + 2, testAddr, [su(i + 2, 0, 10)]))
    )
    const aggregator = await initializeAggregatorWithBlocks(
      blocks,
      BigNumber.from(12)
    )
    blockManager = aggregator['blockManager']
    stateManager = aggregator['stateManager']
  })

  describe('handleBlock', () => {
    test('returns block correctly', async () => {
      const controller = new BlockExplorerController(blockManager, stateManager)
      const b = await controller.handleBlock(BigNumber.from(1))
      expect(b).toEqual({
        blockNumber: '1',
        transactions: 3,
        mainchainBlockNumber: '0',
        timestamp: TIME_STAMP
      })
    })

    test('returns null for too large block number', async () => {
      const controller = new BlockExplorerController(blockManager, stateManager)
      const b = await controller.handleBlock(BigNumber.from(15))
      expect(b).toBeNull()
    })

    test('throws invalid parameter', async () => {
      const controller = new BlockExplorerController(blockManager, stateManager)
      await expect(controller.handleBlock(BigNumber.from(-15))).rejects.toEqual(
        new Error('Invalid Parameter')
      )
    })
  })

  describe('handleBlockList', () => {
    test('returns 10 blocks without params', async () => {
      const controller = new BlockExplorerController(blockManager, stateManager)
      const blocks = await controller.handleBlockList()
      expect(blocks).toEqual([
        {
          blockNumber: '3',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '4',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '5',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '6',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '7',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '8',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '9',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '10',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '11',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '12',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        }
      ])
    })

    test('returns blocks specified with from and to', async () => {
      const controller = new BlockExplorerController(blockManager, stateManager)
      const blocks = await controller.handleBlockList({
        from: BigNumber.from(7),
        to: BigNumber.from(9)
      })
      expect(blocks).toEqual([
        {
          blockNumber: '7',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '8',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '9',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        }
      ])
    })

    test('returns blocks til end only `from` specified', async () => {
      const controller = new BlockExplorerController(blockManager, stateManager)
      const blocks = await controller.handleBlockList({
        from: BigNumber.from(7)
      })
      expect(blocks).toEqual([
        {
          blockNumber: '7',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '8',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '9',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '10',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '11',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '12',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        }
      ])
    })

    test('returns 10 blocks til specified only `to` specified', async () => {
      const controller = new BlockExplorerController(blockManager, stateManager)
      const blocks = await controller.handleBlockList({
        to: BigNumber.from(11)
      })
      expect(blocks).toEqual([
        {
          blockNumber: '2',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '3',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '4',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '5',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '6',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '7',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '8',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '9',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '10',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        },
        {
          blockNumber: '11',
          transactions: 1,
          mainchainBlockNumber: '0',
          timestamp: TIME_STAMP
        }
      ])
    })

    test('returns empty array when specified range is out of the range', async () => {
      const controller = new BlockExplorerController(blockManager, stateManager)
      const blocks = await controller.handleBlockList({
        from: BigNumber.from(15),
        to: BigNumber.from(20)
      })
      expect(blocks).toEqual([])
    })

    test('throws invalid params', async () => {
      const controller = new BlockExplorerController(blockManager, stateManager)
      await expect(
        controller.handleBlockList({
          from: BigNumber.from(-15)
        })
      ).rejects.toEqual(new Error('Invalid Parameter'))
    })
  })

  describe('handleTransactionList', () => {
    test('returns transactions at block', async () => {
      const stateUpdates = [su(1, 0, 10), su(1, 10, 20), su(1, 30, 35)]
      const controller = new BlockExplorerController(blockManager, stateManager)
      const transactions = await controller.handleTransactionList(
        BigNumber.from(1)
      )
      expect(transactions).toEqual(
        stateUpdates.map(su => ({
          hash: su.hash.toHexString(),
          timestamp: TIME_STAMP,
          mainchainBlockNumber: '0',
          blockNumber: '1',
          depositContractAddress: su.depositContractAddress.data,
          stateObject: {
            address: su.stateObject.deciderAddress.data,
            parameter: [testAddr]
          },
          range: {
            start: su.range.start.raw,
            end: su.range.end.raw
          }
        }))
      )
    })

    test('throws when too large block number', async () => {
      const controller = new BlockExplorerController(blockManager, stateManager)
      await expect(
        controller.handleTransactionList(BigNumber.from(20))
      ).rejects.toEqual(new Error('Invalid Parameter'))
    })

    test('throws when negative block number', async () => {
      const controller = new BlockExplorerController(blockManager, stateManager)
      await expect(
        controller.handleTransactionList(BigNumber.from(-1))
      ).rejects.toEqual(new Error('Invalid Parameter'))
    })
  })

  describe('handleTransaction', () => {
    test('returns transaction', async () => {
      const controller = new BlockExplorerController(blockManager, stateManager)
      const s = su(1, 0, 10)
      const tx = await controller.handleTransaction(
        BigNumber.from(1),
        Address.default(),
        BigNumber.from(0),
        BigNumber.from(10)
      )
      expect(tx).toEqual({
        hash: s.hash.toHexString(),
        timestamp: TIME_STAMP,
        mainchainBlockNumber: '0',
        blockNumber: '1',
        depositContractAddress: s.depositContractAddress.data,
        stateObject: {
          address: s.stateObject.deciderAddress.data,
          parameter: [testAddr]
        },
        range: {
          start: s.range.start.raw,
          end: s.range.end.raw
        }
      })
    })

    test('returns null for not existing blockNumber', async () => {
      const controller = new BlockExplorerController(blockManager, stateManager)
      const tx = await controller.handleTransaction(
        BigNumber.from(20),
        Address.default(),
        BigNumber.from(0),
        BigNumber.from(10)
      )
      expect(tx).toBeNull()
    })

    test('returns null for not existing range', async () => {
      const controller = new BlockExplorerController(blockManager, stateManager)
      const tx = await controller.handleTransaction(
        BigNumber.from(1),
        Address.default(),
        BigNumber.from(100),
        BigNumber.from(120)
      )
      expect(tx).toBeNull()
    })
  })
})
