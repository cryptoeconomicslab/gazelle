import { SyncRepository } from '../../src/repository'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import { IndexedDbKeyValueStore } from '@cryptoeconomicslab/indexeddb-kvs'
import { Bytes, BigNumber, FixedBytes } from '@cryptoeconomicslab/primitives'
import { setupContext } from '@cryptoeconomicslab/context'
import JsonCoder from '@cryptoeconomicslab/coder'
import 'fake-indexeddb/auto'
setupContext({ coder: JsonCoder })

describe('SyncRepository', () => {
  let repository: SyncRepository, db: KeyValueStore

  beforeEach(async () => {
    db = new IndexedDbKeyValueStore(Bytes.fromString('sync'))
    repository = await SyncRepository.init(db)
  })

  test('get and update blockNumber', async () => {
    let blockNumber = await repository.getSyncedBlockNumber()
    expect(blockNumber).toEqual(BigNumber.from(0))
    await repository.updateSyncedBlockNumber(BigNumber.from(3))
    blockNumber = await repository.getSyncedBlockNumber()
    expect(blockNumber).toEqual(BigNumber.from(3))
  })

  test('get and update blockRoot', async () => {
    const blockNumber = BigNumber.from(1)
    const root = await repository.getBlockRoot(blockNumber)
    expect(root).toBeNull()

    await repository.insertBlockRoot(blockNumber, FixedBytes.default(32))
    const updatedRoot = await repository.getBlockRoot(blockNumber)
    expect(updatedRoot).toEqual(FixedBytes.default(32))
  })
})
