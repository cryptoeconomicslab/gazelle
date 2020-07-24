import { Checkpoint, StateUpdate } from '@cryptoeconomicslab/plasma'
import { Address, Bytes, Range, Property } from '@cryptoeconomicslab/primitives'
import { KeyValueStore, RangeStore, RangeDb } from '@cryptoeconomicslab/db'
import { decodeStructable } from '@cryptoeconomicslab/coder'

enum Kind {
  SETTLED = 'SETTLED',
  CLAIMED = 'CLAIMED'
}

/**
 * CheckpointRepository
 * stores checkpointed stateUpdate in SettledCheckpoint bucket
 * store stateUpdate with claimedBlockNumber in ClaimedCheckpoint bucket
 */
export class CheckpointRepository {
  static BUCKET_KEY = Bytes.fromString('CHECKPOINT')

  static async init(witnessDb: KeyValueStore): Promise<CheckpointRepository> {
    const storage = await witnessDb.bucket(this.BUCKET_KEY)
    const db = new RangeDb(storage)
    return new CheckpointRepository(db)
  }

  private constructor(private db: RangeStore) {}

  private async getDB(kind: Kind, addr: Address): Promise<RangeStore> {
    const bucket = await this.db.bucket(Bytes.fromString(kind))
    return await bucket.bucket(ovmContext.coder.encode(addr))
  }

  /**
   * @name insertCheckpoint
   * @description insert checkpoint to find checkpoint with rangee
   * @param depositContractAddress deposit contract address of checkpoint
   * @param checkpoint a checkpoint object to insert
   */
  public async insertSettledCheckpoint(stateUpdate: StateUpdate) {
    const db = await this.getDB(
      Kind.SETTLED,
      stateUpdate.depositContractAddress
    )
    const range = stateUpdate.range
    await db.put(
      range.start.data,
      range.end.data,
      ovmContext.coder.encode(stateUpdate.toStruct())
    )
  }

  /**
   * @name getCheckpoints
   * @description get checkpoint with range
   * @param depositContractAddress deposit contract address of checkpoint
   * @param range a range where checkpoint is stored
   */
  public async getSettledCheckpoints(
    depositContractAddress: Address,
    range: Range
  ): Promise<StateUpdate[]> {
    const db = await this.getDB(Kind.SETTLED, depositContractAddress)
    const data = await db.get(range.start.data, range.end.data)
    return data.map(r =>
      decodeStructable(StateUpdate, ovmContext.coder, r.value)
    )
  }

  /**
   * @name insertCheckpoint
   * @description insert checkpoint to find checkpoint with rangee
   * @param depositContractAddress deposit contract address of checkpoint
   * @param checkpoint a checkpoint object to insert
   */
  public async insertClaimedCheckpoint(checkpoint: Checkpoint) {
    const db = await this.getDB(
      Kind.CLAIMED,
      checkpoint.stateUpdate.depositContractAddress
    )
    const range = checkpoint.stateUpdate.range
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
  public async getClaimedCheckpoints(
    depositContractAddress: Address,
    range: Range
  ): Promise<Checkpoint[]> {
    const db = await this.getDB(Kind.CLAIMED, depositContractAddress)
    const data = await db.get(range.start.data, range.end.data)
    return data.map(r =>
      decodeStructable(Checkpoint, ovmContext.coder, r.value)
    )
  }

  /**
   * @name getCheckpoints
   * @description get checkpoint with range
   * @param depositContractAddress deposit contract address of checkpoint
   * @param range a range where checkpoint is stored
   */
  public async removeClaimedCheckpoint(checkpoint: Checkpoint) {
    const db = await this.getDB(
      Kind.CLAIMED,
      checkpoint.stateUpdate.depositContractAddress
    )
    const range = checkpoint.stateUpdate.range
    await db.del(range.start.data, range.end.data)
  }
}
