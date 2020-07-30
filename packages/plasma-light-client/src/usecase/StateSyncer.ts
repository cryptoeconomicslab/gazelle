import EventEmitter from 'event-emitter'
import JSBI from 'jsbi'
import {
  Address,
  Bytes,
  BigNumber,
  Property,
  FixedBytes,
  Range
} from '@cryptoeconomicslab/primitives'
import { decodeStructable } from '@cryptoeconomicslab/coder'
import { StateUpdate, Transaction } from '@cryptoeconomicslab/plasma'
import { KeyValueStore, putWitness } from '@cryptoeconomicslab/db'
import { ICommitmentContract } from '@cryptoeconomicslab/contract'
import { hint as Hint, DeciderManager } from '@cryptoeconomicslab/ovm'
import {
  SyncRepository,
  StateUpdateRepository,
  UserActionRepository,
  CheckpointRepository
} from '../repository'
import { HistoryVerifier } from '../verifier'
import { EmitterEvent, UserActionEvent } from '../ClientEvent'
import { createReceiveUserAction } from '../UserAction'
import APIClient from '../APIClient'
import { getOwner } from '../helper/stateUpdateHelper'
import { getStorageDb } from '../helper/storageDbHelper'
import TokenManager from '../managers/TokenManager'
import { sleep } from '../utils'

export class StateSyncer {
  private historyVerifier: HistoryVerifier
  constructor(
    private ee: EventEmitter,
    private witnessDb: KeyValueStore,
    private commitmentContract: ICommitmentContract,
    private commitmentVerifierAddress: Address,
    private apiClient: APIClient,
    deciderManager: DeciderManager, // will be removed when using checkpointDispute
    private tokenManager: TokenManager,
    private retryInterval: number = 5000
  ) {
    this.historyVerifier = new HistoryVerifier(
      witnessDb,
      apiClient,
      deciderManager
    )
  }

  private async isStateUpdateWithinCheckpoint(
    su: StateUpdate
  ): Promise<boolean> {
    const checkpointRepository = await CheckpointRepository.init(this.witnessDb)
    const checkpoints = await checkpointRepository.getCheckpoints(
      su.depositContractAddress,
      su.range
    )
    if (checkpoints.length > 0) {
      const checkpointStateUpdate = StateUpdate.fromProperty(
        checkpoints[0].stateUpdate
      )
      return (
        JSBI.greaterThanOrEqual(
          su.range.start.data,
          checkpointStateUpdate.range.start.data
        ) &&
        JSBI.lessThanOrEqual(
          su.range.end.data,
          checkpointStateUpdate.range.end.data
        ) &&
        checkpointStateUpdate.blockNumber.equals(su.blockNumber)
      )
    }
    return false
  }

  /**
   * sync latest state
   * @param blockNum
   * @param address
   */
  public async syncLatest(blockNumber: BigNumber, address: Address) {
    const { coder } = ovmContext
    const root = await this.commitmentContract.getRoot(blockNumber)
    if (!root) {
      // FIXME: check if root is default bytes32 value
      throw new Error('Block root hash is null')
    }
    console.log(`syncing latest state: Block{${blockNumber.raw}}`)
    this.ee.emit(EmitterEvent.SYNC_STARTED, blockNumber)
    const stateUpdateRepository = await StateUpdateRepository.init(
      this.witnessDb
    )
    await this.storeRoot(blockNumber, root)

    try {
      const res = await this.apiClient.syncState(address.data)
      const stateUpdates: StateUpdate[] = res.data.map((s: string) =>
        StateUpdate.fromProperty(
          decodeStructable(Property, coder, Bytes.fromHexString(s))
        )
      )
      // if aggregator latest state doesn't have client state, client should check spending proof
      // clear verified state updates
      for (const addr of this.tokenManager.depositContractAddresses) {
        const sus = await stateUpdateRepository.getVerifiedStateUpdates(
          addr,
          new Range(BigNumber.from(0), BigNumber.MAX_NUMBER)
        )
        sus.map(async su => {
          const res = await this.apiClient.spentProof(
            su.depositContractAddress,
            su.blockNumber,
            su.range
          )
          const transactions: Transaction[] = res.data.data.map((tx: string) =>
            Transaction.fromStruct(
              coder.decode(Transaction.getParamTypes(), Bytes.fromHexString(tx))
            )
          )
          // check spent
          transactions.map(async tx => {
            await stateUpdateRepository.removeVerifiedStateUpdate(
              addr,
              tx.range
            )
          })
        })
      }

      const verifyStateUpdate = async (su: StateUpdate, retryTimes = 5) => {
        try {
          await this.syncRootUntil(blockNumber)
          // if su is checkpoint
          const isCheckpoint = await this.isStateUpdateWithinCheckpoint(su)
          if (!isCheckpoint) {
            const verified = await this.historyVerifier.verifyStateUpdateHistory(
              su,
              blockNumber
            )
            if (!verified) {
              // retry verification
              if (retryTimes > 0) {
                await sleep(this.retryInterval)
                await verifyStateUpdate(su, retryTimes - 1)
              }
              return
            }
          }
        } catch (e) {
          console.log(e)
        }
        await stateUpdateRepository.insertVerifiedStateUpdate(
          su.depositContractAddress,
          su
        )
      }
      const promises = stateUpdates.map(async su => verifyStateUpdate(su))
      await Promise.all(promises)
      const syncRepository = await SyncRepository.init(this.witnessDb)
      await syncRepository.updateSyncedBlockNumber(blockNumber)
      await syncRepository.insertBlockRoot(blockNumber, root)

      this.ee.emit(EmitterEvent.SYNC_FINISHED, blockNumber)
    } catch (e) {
      console.error(`Failed syncing state: Block{${blockNumber.raw}}`, e)
    }
  }

  public async syncRootUntil(blockNumber: BigNumber) {
    const { coder } = ovmContext
    let synced = blockNumber
    while (JSBI.greaterThan(synced.data, JSBI.BigInt(0))) {
      const next = BigNumber.from(JSBI.subtract(synced.data, JSBI.BigInt(1)))
      const storageDb = await getStorageDb(this.witnessDb)
      const bucket = await storageDb.bucket(
        coder.encode(this.commitmentVerifierAddress)
      )
      const encodedRoot = await bucket.get(coder.encode(blockNumber))
      if (encodedRoot === null) {
        const root = await this.commitmentContract.getRoot(blockNumber)
        await this.storeRoot(blockNumber, root)
      } else {
        break
      }
      synced = next
    }
  }

  public async storeRoot(blockNumber: BigNumber, root: FixedBytes) {
    const { coder } = ovmContext
    const rootHint = Hint.createRootHint(
      blockNumber,
      this.commitmentVerifierAddress
    )
    await putWitness(this.witnessDb, rootHint, coder.encode(root))
    const storageDb = await getStorageDb(this.witnessDb)
    const bucket = await storageDb.bucket(
      coder.encode(this.commitmentVerifierAddress)
    )
    await bucket.put(coder.encode(blockNumber), coder.encode(root))
  }

  /**
   * fetch latest state from aggregator
   * update local database with new state updates.
   * @param blockNumber block number to sync state
   * @param address Wallet address to sync
   */
  public async sync(
    blockNumber: BigNumber,
    root: FixedBytes,
    address: Address
  ) {
    const { coder } = ovmContext
    console.log(`syncing state: Block{${blockNumber.raw}}`)
    this.ee.emit(EmitterEvent.SYNC_STARTED, blockNumber)
    const stateUpdateRepository = await StateUpdateRepository.init(
      this.witnessDb
    )
    await this.storeRoot(blockNumber, root)

    try {
      const res = await this.apiClient.syncState(address.data, blockNumber)
      const stateUpdates: StateUpdate[] = res.data.map((s: string) =>
        StateUpdate.fromProperty(
          decodeStructable(Property, coder, Bytes.fromHexString(s))
        )
      )

      const promises = stateUpdates.map(async su => {
        try {
          const verified = await this.historyVerifier.verifyStateUpdateHistory(
            su,
            blockNumber
          )
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
        const actionRepository = await UserActionRepository.init(this.witnessDb)
        await actionRepository.insertAction(su.blockNumber, range, action)

        this.ee.emit(UserActionEvent.RECIEVE, action)
      })
      await Promise.all(promises)
      const syncRepository = await SyncRepository.init(this.witnessDb)
      await syncRepository.updateSyncedBlockNumber(blockNumber)
      await syncRepository.insertBlockRoot(blockNumber, root)

      this.ee.emit(EmitterEvent.SYNC_FINISHED, blockNumber)
    } catch (e) {
      console.error(`Failed syncing state: Block{${blockNumber.raw}}`, e)
    }
  }
}
