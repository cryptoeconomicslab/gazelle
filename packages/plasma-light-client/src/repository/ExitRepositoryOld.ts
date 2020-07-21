import { KeyValueStore, RangeDb, RangeStore } from '@cryptoeconomicslab/db'
import { Address, Bytes, Property } from '@cryptoeconomicslab/primitives'
import { IExit, Exit, ExitDeposit } from '@cryptoeconomicslab/plasma'
import { decodeStructable } from '@cryptoeconomicslab/coder'
import JSBI from 'jsbi'

export class ExitRepositoryOld {
  static BUCKET_KEY = Bytes.fromString('EXIT')

  static async init(
    witnessDb: KeyValueStore,
    exitAddress: Address,
    exitDepositAddress: Address
  ): Promise<ExitRepositoryOld> {
    const storage = await witnessDb.bucket(this.BUCKET_KEY)
    const rangeStore = new RangeDb(storage)
    return new ExitRepositoryOld(rangeStore, exitAddress, exitDepositAddress)
  }

  private constructor(
    private db: RangeStore,
    private exitAddress: Address,
    private exitDepositAddress: Address
  ) {}

  private createExitFromProperty(property: Property): IExit | null {
    if (property.deciderAddress.equals(this.exitAddress)) {
      return Exit.fromProperty(property)
    } else if (property.deciderAddress.equals(this.exitDepositAddress)) {
      return ExitDeposit.fromProperty(property)
    }
    return null
  }

  private async getBucket(
    depositContractAddress: Address
  ): Promise<RangeStore> {
    const bucket = await this.db.bucket(
      ovmContext.coder.encode(depositContractAddress)
    )
    return bucket
  }

  public async insertExit(
    depositContractAddress: Address,
    exit: IExit
  ): Promise<void> {
    const bucket = await this.getBucket(depositContractAddress)
    const range = exit.stateUpdate.range
    const propertyBytes = ovmContext.coder.encode(exit.property.toStruct())
    await bucket.put(range.start.data, range.end.data, propertyBytes)
  }

  public async getAllExits(depositContractAddress: Address): Promise<IExit[]> {
    const bucket = await this.getBucket(depositContractAddress)
    const iter = bucket.iter(JSBI.BigInt(0))

    let item = await iter.next()
    const result: IExit[] = []
    while (item !== null) {
      const p = decodeStructable(Property, ovmContext.coder, item.value)
      const exit = this.createExitFromProperty(p)
      if (exit) {
        result.push(exit)
      }
      item = await iter.next()
    }
    return result
  }
}
