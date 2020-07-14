import { Checkpoint } from '@cryptoeconomicslab/plasma'
import { Address, Bytes, Range } from '@cryptoeconomicslab/primitives'
import { KeyValueStore, RangeStore, RangeDb } from '@cryptoeconomicslab/db'
import { decodeStructable } from '@cryptoeconomicslab/coder'

/**
 * CheckpointRepository
 * stores checkpointed stateUpdate
 */
export class CheckpointRepository {
  static BUCKET_KEY = Bytes.fromString('CHECKPOINT')

  static async init(witnessDb: KeyValueStore): Promise<CheckpointRepository> {
    const storage = await witnessDb.bucket(this.BUCKET_KEY)
    const db = new RangeDb(storage)
    return new CheckpointRepository(db)
  }

  private constructor(private db: RangeStore) {}

  private async getRangeDb(addr: Address): Promise<RangeStore> {
    return await this.db.bucket(ovmContext.coder.encode(addr))
  }

  /**
   * @name insertCheckpoint
   * @description insert checkpoint to find checkpoint with rangee
   * @param depositContractAddress deposit contract address of checkpoint
   * @param checkpoint a checkpoint object to insert
   */
  public async insertCheckpoint(
    depositContractAddress: Address,
    checkpoint: Checkpoint
  ) {
    const db = await this.getRangeDb(depositContractAddress)
    const range = decodeStructable(
      Range,
      ovmContext.coder,
      checkpoint.stateUpdate.inputs[1]
    )
    await db.put(
      range.start.data,
      range.end.data,
      ovmContext.coder.encode(checkpoint.toStruct())
    )
  }

  /**
   * @name getCheckpoints
   * @description get checkpoint with range
   * @param depositContractAddress deposit contract address of checkpoint
   * @param range a range where checkpoint is stored
   */
  public async getCheckpoints(
    depositContractAddress: Address,
    range: Range
  ): Promise<Checkpoint[]> {
    const db = await this.getRangeDb(depositContractAddress)
    const data = await db.get(range.start.data, range.end.data)
    return data.map(r =>
      decodeStructable(Checkpoint, ovmContext.coder, r.value)
    )
  }
}
