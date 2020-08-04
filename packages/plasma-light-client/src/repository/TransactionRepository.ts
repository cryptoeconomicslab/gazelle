import { KeyValueStore, RangeDb, RangeStore } from '@cryptoeconomicslab/db'
import {
  Address,
  Bytes,
  BigNumber,
  Range
} from '@cryptoeconomicslab/primitives'
import { SignedTransaction } from '@cryptoeconomicslab/plasma'
import { decodeStructable } from '@cryptoeconomicslab/coder'

export class TransactionRepository {
  static BUCKET_KEY = Bytes.fromString('TRANSACTION')

  static async init(witnessDb: KeyValueStore): Promise<TransactionRepository> {
    const storage = await witnessDb.bucket(this.BUCKET_KEY)
    const rangeStore = new RangeDb(storage)
    return new TransactionRepository(rangeStore)
  }

  private constructor(private db: RangeStore) {}

  private async getBucket(
    depositContractAddress: Address,
    blockNumber: BigNumber
  ): Promise<RangeStore> {
    const { coder } = ovmContext
    const addrBucket = await this.db.bucket(
      coder.encode(depositContractAddress)
    )
    return await addrBucket.bucket(coder.encode(blockNumber))
  }

  public async getTransactions(
    depositContractAddress: Address,
    blockNumber: BigNumber,
    range: Range
  ) {
    const { coder } = ovmContext
    const bucket = await this.getBucket(depositContractAddress, blockNumber)
    const data = await bucket.get(range.start.data, range.end.data)
    return data.map(d => decodeStructable(SignedTransaction, coder, d.value))
  }

  public async insertTransaction(
    depositContractAddress: Address,
    blockNumber: BigNumber,
    range: Range,
    transaction: SignedTransaction
  ) {
    const { coder } = ovmContext
    const bucket = await this.getBucket(depositContractAddress, blockNumber)
    await bucket.put(
      range.start.data,
      range.end.data,
      coder.encode(transaction.toStruct())
    )
  }

  public async removeTransaction(
    depositContractAddress: Address,
    blockNumber: BigNumber,
    range: Range
  ) {
    const bucket = await this.getBucket(depositContractAddress, blockNumber)
    await bucket.del(range.start.data, range.end.data)
  }
}
