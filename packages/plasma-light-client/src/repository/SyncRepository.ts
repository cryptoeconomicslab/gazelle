import { KeyValueStore } from '@cryptoeconomicslab/db'
import { FixedBytes, Bytes, BigNumber } from '@cryptoeconomicslab/primitives'

const LATEST_SYNCED_BLOCK = Bytes.fromString('latest_synced_block')

export class SyncRepository {
  static BUCKET_KEY = Bytes.fromString('SYNC')

  static async init(witnessDb: KeyValueStore): Promise<SyncRepository> {
    const storage = await witnessDb.bucket(this.BUCKET_KEY)
    return new SyncRepository(storage)
  }

  private constructor(readonly db: KeyValueStore) {}

  public async getSyncedBlockNumber(): Promise<BigNumber> {
    const d = await this.db.get(LATEST_SYNCED_BLOCK)

    if (!d) return BigNumber.from(-1)
    return ovmContext.coder.decode(BigNumber.default(), d)
  }

  /**
   * update synced block number and save root hash of the block
   * @param blockNumber block number to be set as LATEST_SYNCED_BLOCK
   * @param root root hash of the newly synced block
   */
  public async updateSyncedBlockNumber(blockNumber: BigNumber): Promise<void> {
    await this.db.put(LATEST_SYNCED_BLOCK, ovmContext.coder.encode(blockNumber))
  }

  public async getBlockRoot(
    blockNumber: BigNumber
  ): Promise<FixedBytes | null> {
    const data = await this.db.get(ovmContext.coder.encode(blockNumber))
    if (!data) return null
    return FixedBytes.from(32, data.data)
  }

  public async insertBlockRoot(blockNumber: BigNumber, root: FixedBytes) {
    await this.db.put(
      ovmContext.coder.encode(blockNumber),
      Bytes.from(root.data)
    )
  }
}
