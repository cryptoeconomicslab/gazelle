import { KeyValueStore, RangeStore, RangeDb } from '@cryptoeconomicslab/db'
import { Range, Bytes, BigNumber } from '@cryptoeconomicslab/primitives'
import UserAction from '../UserAction'
import JSBI from 'jsbi'

export class UserActionRepository {
  static BUCKET_KEY = Bytes.fromString('USER_ACTION')

  static async init(witnessDb: KeyValueStore): Promise<UserActionRepository> {
    const storage = await witnessDb.bucket(this.BUCKET_KEY)
    const rangeDb = new RangeDb(storage)
    return new UserActionRepository(rangeDb)
  }

  private constructor(readonly db: RangeStore) {}

  private async getBucket(blockNumber: BigNumber): Promise<RangeStore> {
    return await this.db.bucket(ovmContext.coder.encode(blockNumber))
  }

  public async insertAction(
    blockNumber: BigNumber,
    range: Range,
    action: UserAction
  ) {
    const bucket = await this.getBucket(blockNumber)
    await bucket.put(
      range.start.data,
      range.end.data,
      ovmContext.coder.encode(action.toStruct())
    )
  }

  /**
   * get user actions at given blockNumber
   * @param blockNumber blockNumber to get userAction
   */
  public async getUserActions(blockNumber: BigNumber): Promise<UserAction[]> {
    const bucket = await this.getBucket(blockNumber)
    const iter = bucket.iter(JSBI.BigInt(0))
    let item = await iter.next()
    const result: UserAction[] = []
    while (item !== null) {
      result.push(
        UserAction.fromStruct(
          ovmContext.coder.decode(UserAction.getParamTypes(), item.value)
        )
      )
      item = await iter.next()
    }
    return result
  }
}
