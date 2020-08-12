import {
  StateUpdate,
  Block,
  StateUpdateRecord
} from '@cryptoeconomicslab/plasma'
import {
  Address,
  Bytes,
  BigNumber,
  Integer,
  Range
} from '@cryptoeconomicslab/primitives'
import {
  RangeDb,
  RangeStore,
  KeyValueStore,
  RangeRecord
} from '@cryptoeconomicslab/db'
import { decodeStructable } from '@cryptoeconomicslab/coder'
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
    return currentBlock.increment()
  }

  private async setBlockNumber(blockNumber: BigNumber): Promise<void> {
    await this.kvs.put(
      Bytes.fromString('blockNumber'),
      ovmContext.coder.encode(blockNumber)
    )
  }

  public async updateSubmittedBlock(blockNumber: BigNumber): Promise<void> {
    const submittedBlockNumber = await this.getSubmittedBlock()
    if (JSBI.greaterThan(blockNumber.data, submittedBlockNumber.data)) {
      await this.setSubmittedBlock(blockNumber)
    }
  }

  private async setSubmittedBlock(blockNumber: BigNumber): Promise<void> {
    await this.kvs.put(
      Bytes.fromString('submittedBlockNumber'),
      ovmContext.coder.encode(blockNumber)
    )
  }

  public async getSubmittedBlock(): Promise<BigNumber> {
    const data = await this.kvs.get(Bytes.fromString('submittedBlockNumber'))
    if (!data) return BigNumber.from(0)
    return ovmContext.coder.decode(BigNumber.default(), data)
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
   * create next block.
   */
  public async generateNextBlock(): Promise<Block | null> {
    const blockNumber = await this.getCurrentBlockNumber()
    return await this.generateBlock(blockNumber)
  }

  /**
   * create block of provided blockNumber with pending state updates in block
   * store new block and clear all pending updates in block db.
   */
  private async generateBlock(blockNumber: BigNumber): Promise<Block | null> {
    const nextBlockNumber = blockNumber.increment()

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

        return stateUpdateRanges
      })
    )

    // In case no stateUpdates have been enqueued, return undefined
    if (sus.every(arr => arr.length === 0)) {
      return null
    }

    const block = new Block(
      nextBlockNumber,
      stateUpdatesMap,
      BigNumber.from(0),
      Integer.from(0)
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
   * update block with mainchain blockNumber and timestamp
   * @param blockNumber block number of plasma
   * @param mainchainBlockNumber block number of mainchain
   * @param mainchainTimestamp timestamp of mainchain
   */
  public async updateBlock(
    blockNumber: BigNumber,
    mainchainBlockNumber: BigNumber,
    mainchainTimestamp: Integer
  ) {
    const block = await this.getBlock(blockNumber)
    if (!block) {
      throw new Error(`Block ${blockNumber.toString()} not found`)
    }
    block.setMainchainBlockNumber(mainchainBlockNumber)
    block.setTimestamp(mainchainTimestamp)
    await this.putBlock(block)
  }

  /**
   * register new token
   * @param tokenAddress token address to be registered
   */
  public registerToken(tokenAddress: Address) {
    this.tokenList.push(tokenAddress)
  }
}
