import { StateUpdate } from '@cryptoeconomicslab/plasma'
import {
  Address,
  Bytes,
  BigNumber,
  Range
} from '@cryptoeconomicslab/primitives'
import { KeyValueStore, RangeDb } from '@cryptoeconomicslab/db'
import JSBI from 'jsbi'
import { Numberish } from '../types'

enum Kind {
  Verified = 'Verified',
  Unverified = 'Unverified',
  Pending = 'Pending',
  Exit = 'Exit'
}

export class StateUpdateRepository {
  static BUCKET_KEY = Bytes.fromString('STATE_UPDATE')

  static async init(witnessDb: KeyValueStore): Promise<StateUpdateRepository> {
    const storage = await witnessDb.bucket(this.BUCKET_KEY)
    return new StateUpdateRepository(storage)
  }

  private constructor(private db: KeyValueStore) {}

  private async getRangeDb(kind: Kind, addr: Address): Promise<RangeDb> {
    const bucket = await (await this.db.bucket(Bytes.fromString(kind))).bucket(
      Bytes.fromString(addr.raw)
    )
    return new RangeDb(bucket)
  }

  /**
   * get StateUpdates from database
   * @param kind (Verified | Unverified | Pending) represent the state of StateUpdate
   * @param depositContractAddress deposit contract address of StateUpdate
   * @param range get state updates within or intersected with this range
   */
  private async getStateUpdates(
    kind: Kind,
    depositContractAddress: Address,
    range: Range
  ): Promise<StateUpdate[]> {
    const db = await this.getRangeDb(kind, depositContractAddress)
    const data = await db.get(range.start.data, range.end.data)
    return data.map(StateUpdate.fromRangeRecord)
  }

  /**
   * insert StateUpdate to database
   * @param kind (Verified | Unverified | Pending) represent the state of StateUpdate
   * @param depositContractAddress deposit contract address of StateUpdate
   * @param stateUpdate StateUpdate to insert
   */
  private async insertStateUpdate(
    kind: Kind,
    depositContractAddress: Address,
    stateUpdate: StateUpdate
  ): Promise<void> {
    const db = await this.getRangeDb(kind, depositContractAddress)
    const range = stateUpdate.range
    const record = stateUpdate.toRecord()
    await db.put(
      range.start.data,
      range.end.data,
      ovmContext.coder.encode(record.toStruct())
    )
  }

  /**
   * remove StateUpdate of given range in database
   * because RangeDb.delete method remove whole intersected range, temporarily update removed range and delete it.
   * @param kind (Verified | Unverified | Pending) represent the state of StateUpdate
   * @param depositContractAddress deposit contract address of StateUpdate
   * @param range Range to be removed
   */
  private async removeStateUpdate(
    kind: Kind,
    depositContractAddress: Address,
    range: Range
  ): Promise<void> {
    const db = await this.getRangeDb(kind, depositContractAddress)
    await db.put(range.start.data, range.end.data, Bytes.default())
    await db.del(range.start.data, range.end.data)
  }

  //
  // Verified state update
  //

  public async getVerifiedStateUpdates(
    depositContractAddress: Address,
    range: Range
  ): Promise<StateUpdate[]> {
    return await this.getStateUpdates(
      Kind.Verified,
      depositContractAddress,
      range
    )
  }

  public async insertVerifiedStateUpdate(
    depositContractAddress: Address,
    stateUpdate: StateUpdate
  ): Promise<void> {
    await this.insertStateUpdate(
      Kind.Verified,
      depositContractAddress,
      stateUpdate
    )
  }

  public async removeVerifiedStateUpdate(
    depositContractAddress: Address,
    range: Range
  ): Promise<void> {
    await this.removeStateUpdate(Kind.Verified, depositContractAddress, range)
  }

  //
  // Pending state update
  //

  public async getPendingStateUpdates(
    depositContractAddress: Address,
    range: Range
  ): Promise<StateUpdate[]> {
    return await this.getStateUpdates(
      Kind.Pending,
      depositContractAddress,
      range
    )
  }

  public async insertPendingStateUpdate(
    depositContractAddress: Address,
    stateUpdate: StateUpdate
  ): Promise<void> {
    await this.insertStateUpdate(
      Kind.Pending,
      depositContractAddress,
      stateUpdate
    )
  }

  public async removePendingStateUpdate(
    depositContractAddress: Address,
    range: Range
  ): Promise<void> {
    await this.removeStateUpdate(Kind.Pending, depositContractAddress, range)
  }

  //
  // Unverified state update
  //

  public async getUnverifiedStateUpdates(
    depositContractAddress: Address,
    range: Range
  ): Promise<StateUpdate[]> {
    return await this.getStateUpdates(
      Kind.Unverified,
      depositContractAddress,
      range
    )
  }

  public async insertUnverifiedStateUpdate(
    depositContractAddress: Address,
    stateUpdate: StateUpdate
  ): Promise<void> {
    await this.insertStateUpdate(
      Kind.Unverified,
      depositContractAddress,
      stateUpdate
    )
  }

  public async removeUnverifiedStateUpdate(
    depositContractAddress: Address,
    range: Range
  ): Promise<void> {
    await this.removeStateUpdate(Kind.Unverified, depositContractAddress, range)
  }

  //
  // Exit state update
  //

  public async getExitStateUpdates(
    depositContractAddress: Address,
    range: Range
  ): Promise<StateUpdate[]> {
    return await this.getStateUpdates(Kind.Exit, depositContractAddress, range)
  }

  public async insertExitStateUpdate(
    depositContractAddress: Address,
    stateUpdate: StateUpdate
  ): Promise<void> {
    await this.insertStateUpdate(Kind.Exit, depositContractAddress, stateUpdate)
  }
  public async removeExitStateUpdate(
    depositContractAddress: Address,
    range: Range
  ): Promise<void> {
    await this.removeStateUpdate(Kind.Exit, depositContractAddress, range)
  }

  /**
   * ResolveStateUpdate
   * resolve state updates with given amount.
   * returns state updates whose range would be summed up to exact amount of second arg.
   * resolving logic is following
   * 1. if there is one state update whose range is greater than or equal to given amount,
   *    returns the state update with the exact subrange.
   * 2. else if there are multiple state updates that can cover the amount,
   *    returns those state updates but the last state update is truncated to subrange.
   * 3. else returns empty array
   * @param depositContractAddress deposit contract address
   * @param amount amount to resolve
   */
  public async resolveStateUpdate(
    depositContractAddress: Address,
    val: Numberish
  ): Promise<StateUpdate[] | null> {
    const amount = JSBI.BigInt(val)
    const db = await this.getRangeDb(Kind.Verified, depositContractAddress)
    const stateUpdates: StateUpdate[] = []
    const iter = db.iter(JSBI.BigInt(0))

    let next = await iter.next()
    let sum = JSBI.BigInt(0)
    while (next !== null && JSBI.notEqual(sum, amount)) {
      const su = StateUpdate.fromRangeRecord(next)
      if (JSBI.greaterThan(JSBI.add(sum, su.amount), amount)) {
        su.update({
          range: new Range(
            su.range.start,
            BigNumber.from(
              JSBI.subtract(
                su.range.end.data,
                JSBI.subtract(JSBI.add(sum, su.amount), amount)
              )
            )
          )
        })
        stateUpdates.push(su)
        return stateUpdates
      }

      stateUpdates.push(su)
      sum = JSBI.add(su.amount, sum)
      next = await iter.next()
    }

    if (JSBI.lessThan(sum, amount)) {
      return null
    }

    return stateUpdates
  }
}
