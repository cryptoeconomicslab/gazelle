import EventEmitter from 'event-emitter'
import JSBI from 'jsbi'
import {
  Address,
  Bytes,
  BigNumber,
  Property,
  FixedBytes
} from '@cryptoeconomicslab/primitives'
import { decodeStructable } from '@cryptoeconomicslab/coder'
import { StateUpdate } from '@cryptoeconomicslab/plasma'
import { KeyValueStore, putWitness } from '@cryptoeconomicslab/db'
import { ICommitmentContract } from '@cryptoeconomicslab/contract'
import { hint as Hint } from '@cryptoeconomicslab/ovm'
import {
  SyncRepository,
  StateUpdateRepository,
  UserActionRepository
} from '../repository'
import { EmitterEvent, UserActionEvent } from '../ClientEvent'
import { createReceiveUserAction } from '../UserAction'
import APIClient from '../APIClient'
import { getOwner } from '../helper/stateUpdateHelper'
import { getStorageDb } from '../helper/storageDbHelper'
import TokenManager from '../managers/TokenManager'
import { CheckpointDispute } from '../dispute/CheckpointDispute'

export class StateSyncer {
  constructor(
    private ee: EventEmitter,
    private witnessDb: KeyValueStore,
    private commitmentContract: ICommitmentContract,
    private commitmentContractAddress: Address,
    private apiClient: APIClient,
    private tokenManager: TokenManager,
    private checkpointDispute: CheckpointDispute
  ) {}

  /**
   * sync local state to given block number
   * @param blockNum block number to which client should sync
   * @param address Wallet address to sync
   */
  public async syncUntil(blockNum: BigNumber, address: Address) {
    const syncRepository = await SyncRepository.init(this.witnessDb)
    let synced = await syncRepository.getSyncedBlockNumber()
    console.log(
      `Start syncing state: Block{${synced.raw}} to Block{${blockNum.raw}}`
    )

    if (JSBI.greaterThan(synced.data, blockNum.data)) {
      throw new Error('Synced state is greater than latest block')
    }

    while (JSBI.notEqual(synced.data, blockNum.data)) {
      const next = BigNumber.from(JSBI.add(synced.data, JSBI.BigInt(1)))
      await this.sync(next, address)

      synced = next
    }
  }

  /**
   * fetch latest state from aggregator
   * update local database with new state updates.
   * @param blockNumber block number to sync state
   * @param address Wallet address to sync
   */
  public async sync(blockNumber: BigNumber, address: Address) {
    const { coder } = ovmContext
    const commitmentAddress = this.commitmentContractAddress
    const root = await this.commitmentContract.getRoot(blockNumber)
    if (root.equals(FixedBytes.default(32))) {
      throw new Error('Block root hash is null')
    }
    console.log(`syncing state: Block{${blockNumber.raw}}`)
    this.ee.emit(EmitterEvent.SYNC_STARTED, blockNumber)
    const stateUpdateRepository = await StateUpdateRepository.init(
      this.witnessDb
    )

    const rootHint = Hint.createRootHint(blockNumber, commitmentAddress)
    await putWitness(this.witnessDb, rootHint, coder.encode(root))

    const storageDb = await getStorageDb(this.witnessDb)
    const bucket = await storageDb.bucket(coder.encode(commitmentAddress))
    await bucket.put(coder.encode(blockNumber), coder.encode(root))

    try {
      const res = await this.apiClient.syncState(address.data, blockNumber)
      const stateUpdates: StateUpdate[] = res.data.map((s: string) =>
        StateUpdate.fromProperty(
          decodeStructable(Property, coder, Bytes.fromHexString(s))
        )
      )
      await Promise.all(
        stateUpdates.map(async su => {
          try {
            await this.checkpointDispute.prepareCheckpointWitness(su)
            const verified = await this.checkpointDispute.verifyCheckpoint(su)
            if (!verified) return
          } catch (e) {
            console.log(e)
          }

          await stateUpdateRepository.insertVerifiedStateUpdate(
            su.depositContractAddress,
            su
          )
          // store receive user action
          const { range } = su
          const tokenContractAddress = this.tokenManager.getTokenContractAddress(
            su.depositContractAddress
          )
          if (!tokenContractAddress)
            throw new Error('Token Contract Address not found')

          const action = createReceiveUserAction(
            Address.from(tokenContractAddress),
            range,
            getOwner(su), // FIXME: this is same as client's owner
            su.blockNumber
          )
          const actionRepository = await UserActionRepository.init(
            this.witnessDb
          )
          await actionRepository.insertAction(su.blockNumber, range, action)

          this.ee.emit(UserActionEvent.RECIEVE, action)
        })
      )
      const syncRepository = await SyncRepository.init(this.witnessDb)
      await syncRepository.updateSyncedBlockNumber(blockNumber)
      await syncRepository.insertBlockRoot(blockNumber, root)

      this.ee.emit(EmitterEvent.SYNC_FINISHED, blockNumber)
    } catch (e) {
      console.error(`Failed syncing state: Block{${blockNumber.raw}}`, e)
    }
  }
}
