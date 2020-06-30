import {
  StateUpdate,
  Block,
  StateUpdateRecord
} from '@cryptoeconomicslab/plasma'
import {
  Address,
  Bytes,
  BigNumber,
  Range
} from '@cryptoeconomicslab/primitives'
import {
  RangeDb,
  RangeStore,
  KeyValueStore,
  RangeRecord
} from '@cryptoeconomicslab/db'
import { decodeStructable } from '@cryptoeconomicslab/coder'
import { DateUtils } from '@cryptoeconomicslab/utils'
import JSBI from 'jsbi'

const STATE_UPDATE_BUCKET = Bytes.fromString('queued_state_updates')
const BLOCK_BUCKET = Bytes.fromString('block')

export default class BlockManager {
  private tokenList: Address[]

  constructor(private kvs: KeyValueStore) {
    this.tokenList = []
  }

  private async tokenBucket(
    blockNumber: BigNumber,
    addr: Address
  ): Promise<RangeStore> {
    const rangeDb = new RangeDb(await this.kvs.bucket(STATE_UPDATE_BUCKET))
    const blockBucket = await rangeDb.bucket(
      ovmContext.coder.encode(blockNumber)
    )
    return await blockBucket.bucket(Bytes.fromString(addr.data))
  }

  /**
   * remove all state updates of given token address
   * @param addr token address which state updates belongs to, will be deleted
   */
  private async clearTokenBucket(blockNumber: BigNumber, addr: Address) {
    const db = await this.tokenBucket(blockNumber, addr)
    await db.del(
      JSBI.BigInt(0),
      JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(256))
    )
  }

  /**
   * returns current block number
   */
  public async getCurrentBlockNumber(): Promise<BigNumber> {
    const data = await this.kvs.get(Bytes.fromString('blockNumber'))
    if (!data) return BigNumber.from(0)
    return ovmContext.coder.decode(BigNumber.default(), data)
  }

  /**
   * returns next block number
   */
  public async getNextBlockNumber(): Promise<BigNumber> {
    const currentBlock = await this.getCurrentBlockNumber()
    return BigNumber.from(JSBI.add(currentBlock.data, JSBI.BigInt(1)))
  }

  private async setBlockNumber(blockNumber: BigNumber): Promise<void> {
    await this.kvs.put(
      Bytes.fromString('blockNumber'),
      ovmContext.coder.encode(blockNumber)
    )
  }

  /**
   * append state update for next block
   * @param su state update to be appended for next block submission
   */
  public async enqueuePendingStateUpdate(su: StateUpdate) {
    console.log('enqueue state update', su)
    const blockNumber = await this.getCurrentBlockNumber()
    const { start, end } = su.range
    const bucket = await this.tokenBucket(
      blockNumber,
      su.depositContractAddress
    )
    await bucket.put(
      start.data,
      end.data,
      ovmContext.coder.encode(su.toRecord().toStruct())
    )
  }

  /**
   * create next block with pending state updates in block
   * store new block and clear all pending updates in block db.
   */
  public async generateNextBlock(): Promise<Block | undefined> {
    const blockNumber = await this.getCurrentBlockNumber()
    const nextBlockNumber = BigNumber.from(
      JSBI.add(JSBI.BigInt(1), blockNumber.data)
    )

    const stateUpdatesMap = new Map()
    const sus = await Promise.all(
      this.tokenList.map(async token => {
        const db = await this.tokenBucket(blockNumber, token)
        const stateUpdateRanges: RangeRecord[] = []
        const cursor = db.iter(JSBI.BigInt(0))
        let su = await cursor.next()
        while (su !== null) {
          stateUpdateRanges.push(su)
          su = await cursor.next()
        }
        if (stateUpdateRanges.length === 0) return []

        const stateUpdates = stateUpdateRanges.map(r =>
          StateUpdate.fromRecord(
            decodeStructable(StateUpdateRecord, ovmContext.coder, r.value),
            new Range(r.start, r.end)
          )
        )
        stateUpdatesMap.set(token.data, stateUpdates)

        await this.clearTokenBucket(blockNumber, token)
        return stateUpdateRanges
      })
    )

    // In case no stateUpdates have been enqueued, return undefined
    if (sus.every(arr => arr.length === 0)) {
      return
    }

    const timestamp = DateUtils.getCurrentDate()
    const block = new Block(
      BigNumber.from(JSBI.add(blockNumber.data, JSBI.BigInt(1))),
      stateUpdatesMap,
      timestamp
    )
    await this.putBlock(block)
    await this.setBlockNumber(nextBlockNumber)

    return block
  }

  /**
   * get block from database
   * @param blockNumber block number to fetch
   * @returns {Promise<Block | null>}
   */
  public async getBlock(blockNumber: BigNumber): Promise<Block | null> {
    const blockBucket = await this.kvs.bucket(BLOCK_BUCKET)
    const res = await blockBucket.get(ovmContext.coder.encode(blockNumber))
    if (!res) return null
    return decodeStructable(Block, ovmContext.coder, res)
  }

  /**
   * save block to database
   * @param block block to save
   */
  public async putBlock(block: Block): Promise<void> {
    const blockBucket = await this.kvs.bucket(BLOCK_BUCKET)
    await blockBucket.put(
      ovmContext.coder.encode(BigNumber.from(block.blockNumber)),
      ovmContext.coder.encode(block.toStruct())
    )
  }

  /**
   * register new token
   * @param tokenAddress token address to be registered
   */
  public registerToken(tokenAddress: Address) {
    this.tokenList.push(tokenAddress)
  }
}
