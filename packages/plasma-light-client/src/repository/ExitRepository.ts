import { Exit, StateUpdate } from '@cryptoeconomicslab/plasma'
import {
  Address,
  Bytes,
  Range,
  Property,
  BigNumber
} from '@cryptoeconomicslab/primitives'
import { KeyValueStore, RangeStore, RangeDb } from '@cryptoeconomicslab/db'
import { decodeStructable } from '@cryptoeconomicslab/coder'

enum Kind {
  SETTLED = 'SETTLED',
  CLAIMED = 'CLAIMED'
}

/**
 * ExitRepository
 * stores exiting stateUpdate in SettledExit bucket
 * store stateUpdate with claimedBlockNumber in ClaimedExit bucket
 */
export class ExitRepository {
  static BUCKET_KEY = Bytes.fromString('EXIT')

  static async init(witnessDb: KeyValueStore): Promise<ExitRepository> {
    const storage = await witnessDb.bucket(this.BUCKET_KEY)
    const db = new RangeDb(storage)
    return new ExitRepository(db)
  }

  private constructor(private db: RangeStore) {}

  private async getDB(kind: Kind, addr: Address): Promise<RangeStore> {
    const bucket = await this.db.bucket(Bytes.fromString(kind))
    return await bucket.bucket(ovmContext.coder.encode(addr))
  }

  /**
   * @name insertExit
   * @description insert exit to find exit with rangee
   * @param depositContractAddress deposit contract address of exit
   * @param exit a exit object to insert
   */
  public async insertSettledExit(stateUpdate: StateUpdate) {
    const db = await this.getDB(
      Kind.SETTLED,
      stateUpdate.depositContractAddress
    )
    const range = stateUpdate.range
    await db.put(
      range.start.data,
      range.end.data,
      ovmContext.coder.encode(stateUpdate.property.toStruct())
    )
  }

  /**
   * @name getExits
   * @description get exit with range
   * @param depositContractAddress deposit contract address of exit
   * @param range a range where exit is stored
   */
  public async getSettledExits(
    depositContractAddress: Address,
    range: Range
  ): Promise<StateUpdate[]> {
    const db = await this.getDB(Kind.SETTLED, depositContractAddress)
    const data = await db.get(range.start.data, range.end.data)
    return data.map(r =>
      StateUpdate.fromProperty(
        decodeStructable(Property, ovmContext.coder, r.value)
      )
    )
  }

  /**
   * @name insertExit
   * @description insert exit to find exit with rangee
   * @param depositContractAddress deposit contract address of exit
   * @param exit a exit object to insert
   */
  public async insertClaimedExit(exit: Exit) {
    const db = await this.getDB(
      Kind.CLAIMED,
      exit.stateUpdate.depositContractAddress
    )
    const range = exit.stateUpdate.range
    await db.put(
      range.start.data,
      range.end.data,
      ovmContext.coder.encode(exit.toStruct())
    )
  }

  /**
   * @name getExits
   * @description get exit with range
   * @param depositContractAddress deposit contract address of exit
   * @param range a range where exit is stored
   */
  public async getClaimedExits(
    depositContractAddress: Address,
    range: Range
  ): Promise<Exit[]> {
    const db = await this.getDB(Kind.CLAIMED, depositContractAddress)
    const data = await db.get(range.start.data, range.end.data)
    return data.map(r => decodeStructable(Exit, ovmContext.coder, r.value))
  }

  public async getAllClaimedExits(
    depositContractAddress: Address
  ): Promise<Exit[]> {
    return this.getClaimedExits(
      depositContractAddress,
      new Range(BigNumber.from(0), BigNumber.MAX_NUMBER)
    )
  }

  /**
   * @name getExits
   * @description get exit with range
   * @param depositContractAddress deposit contract address of exit
   * @param range a range where exit is stored
   */
  public async removeClaimedExit(exit: Exit) {
    const db = await this.getDB(
      Kind.CLAIMED,
      exit.stateUpdate.depositContractAddress
    )
    const range = exit.stateUpdate.range
    await db.del(range.start.data, range.end.data)
  }
}
