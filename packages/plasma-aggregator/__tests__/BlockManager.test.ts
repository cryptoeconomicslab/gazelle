import BlockManager from '../src/managers/BlockManager'
import { Block, StateUpdate } from '@cryptoeconomicslab/plasma'
import { InMemoryKeyValueStore } from '@cryptoeconomicslab/level-kvs'
import {
  Address,
  Bytes,
  FixedBytes,
  BigNumber,
  Integer,
  Property,
  Range
} from '@cryptoeconomicslab/primitives'
import Coder from '@cryptoeconomicslab/coder'
import { setupContext } from '@cryptoeconomicslab/context'
import { DateUtils } from '@cryptoeconomicslab/utils'
setupContext({
  coder: Coder
})

const su = (start: number, end: number): StateUpdate => {
  return new StateUpdate(
    Address.default(),
    new Range(BigNumber.from(start), BigNumber.from(end)),
    BigNumber.from(1),
    new Property(Address.default(), [Bytes.fromHexString('0x01')]),
    FixedBytes.default(32)
  )
}

const stateUpdate = su(0, 10)

describe('BlockManager', () => {
  let blockManager: BlockManager, kvs: InMemoryKeyValueStore

  beforeEach(async () => {
    kvs = new InMemoryKeyValueStore(Bytes.fromString('block_manager'))
    blockManager = new BlockManager(kvs)
    blockManager.registerToken(Address.default())
  })

  test('get and put block', async () => {
    const map = new Map()
    map.set('0x0001100000000000000000000000000100110011', [
      stateUpdate,
      stateUpdate
    ])
    map.set('0x0001100110011001100110011001101100110011', [stateUpdate])
    const timestamp = DateUtils.getCurrentDate()
    const block1 = new Block(
      BigNumber.from(1),
      map,
      BigNumber.from(0),
      Integer.from(timestamp)
    )
    console.log(block1, block1.toStruct())
    await blockManager.putBlock(block1)
    const res = await blockManager.getBlock(BigNumber.from(1))
    expect(res).toEqual(block1)
  })

  test('get to be null if no block is stored for given block number', async () => {
    const res = await blockManager.getBlock(BigNumber.from(1))
    expect(res).toBeNull()
  })

  test('generateBlock increment block number', async () => {
    await blockManager.enqueuePendingStateUpdate(stateUpdate)
    let currentBlockNumber = await blockManager.getCurrentBlockNumber()
    expect(currentBlockNumber).toEqual(BigNumber.from(0))
    await blockManager.generateNextBlock()
    currentBlockNumber = await blockManager.getCurrentBlockNumber()
    expect(currentBlockNumber).toEqual(BigNumber.from(1))
  })

  test('generateBlock', async () => {
    await blockManager.enqueuePendingStateUpdate(stateUpdate)
    const block = await blockManager.generateNextBlock()
    const map = new Map<string, StateUpdate[]>()
    map.set(Address.default().data, [stateUpdate])
    const expected = new Block(
      BigNumber.from(1),
      map,
      BigNumber.from(0),
      Integer.from(0)
    )
    expect(block).toEqual(expected)
  })
})
