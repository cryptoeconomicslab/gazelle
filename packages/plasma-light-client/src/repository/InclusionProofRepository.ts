import { KeyValueStore, RangeDb, RangeStore } from '@cryptoeconomicslab/db'
import {
  Address,
  Bytes,
  BigNumber,
  Range
} from '@cryptoeconomicslab/primitives'
import { DoubleLayerInclusionProof } from '@cryptoeconomicslab/merkle-tree'
import { decodeStructable } from '@cryptoeconomicslab/coder'

export class InclusionProofRepository {
  static BUCKET_KEY = Bytes.fromString('INCLUSION_PROOF')

  static async init(
    witnessDb: KeyValueStore
  ): Promise<InclusionProofRepository> {
    const storage = await witnessDb.bucket(this.BUCKET_KEY)
    const rangeStore = new RangeDb(storage)
    return new InclusionProofRepository(rangeStore)
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

  public async getInclusionProofs(
    depositContractAddress: Address,
    blockNumber: BigNumber,
    range: Range
  ) {
    const { coder } = ovmContext
    const bucket = await this.getBucket(depositContractAddress, blockNumber)
    const data = await bucket.get(range.start.data, range.end.data)
    return data.map(d =>
      decodeStructable(DoubleLayerInclusionProof, coder, d.value)
    )
  }

  public async insertInclusionProof(
    depositContractAddress: Address,
    blockNumber: BigNumber,
    range: Range,
    inclusionProof: DoubleLayerInclusionProof
  ) {
    const { coder } = ovmContext
    const bucket = await this.getBucket(depositContractAddress, blockNumber)
    await bucket.put(
      range.start.data,
      range.end.data,
      coder.encode(inclusionProof.toStruct())
    )
  }

  public async removeInclusionProof(
    depositContractAddress: Address,
    blockNumber: BigNumber,
    range: Range
  ) {
    const bucket = await this.getBucket(depositContractAddress, blockNumber)
    await bucket.del(range.start.data, range.end.data)
  }
}
