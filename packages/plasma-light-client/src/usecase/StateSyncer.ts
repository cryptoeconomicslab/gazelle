import EventEmitter from 'event-emitter'
import JSBI from 'jsbi'
import {
  Address,
  Bytes,
  BigNumber,
  FixedBytes,
  Range
} from '@cryptoeconomicslab/primitives'
import { decodeStructable } from '@cryptoeconomicslab/coder'
import { IncludedTransaction, StateUpdate } from '@cryptoeconomicslab/plasma'
import { KeyValueStore, putWitness } from '@cryptoeconomicslab/db'
import { ICommitmentContract } from '@cryptoeconomicslab/contract'
import { hint as Hint, DeciderManager } from '@cryptoeconomicslab/ovm'
import {
  SyncRepository,
  StateUpdateRepository,
  UserActionRepository
} from '../repository'
import { EmitterEvent, UserActionEvent } from '../ClientEvent'
import { createReceiveUserAction, createSendUserAction } from '../UserAction'
import APIClient from '../APIClient'
import { getOwner } from '../helper/stateUpdateHelper'
import * as StateObjectHelper from '../helper/stateObjectHelper'
import { getStorageDb } from '../helper/storageDbHelper'
import TokenManager from '../managers/TokenManager'
import { CheckpointDispute } from '../dispute/CheckpointDispute'
import { verifyCheckpoint } from '../verifier/CheckpointVerifier'
import { prepareCheckpointWitness } from '../helper/checkpointWitnessHelper'
import { sleep } from '../utils'

export class StateSyncer {
  constructor(
    private ee: EventEmitter,
    private witnessDb: KeyValueStore,
    private commitmentContract: ICommitmentContract,
    private commitmentVerifierAddress: Address,
    private apiClient: APIClient,
    private tokenManager: TokenManager,
    private deciderManager: DeciderManager,
    private checkpointDispute: CheckpointDispute,
    private retryInterval: number = 5000
  ) {}

  private async syncTransfers() {
    const { coder } = ovmContext
    // check sending to other accounts
    const stateUpdateRepository = await StateUpdateRepository.init(
      this.witnessDb
    )
    for (const addr of this.tokenManager.depositContractAddresses) {
      const wholeRange = new Range(BigNumber.from(0), BigNumber.MAX_NUMBER)
      const sus = await stateUpdateRepository.getVerifiedStateUpdates(
        addr,
        wholeRange
      )
      const pendingStateUpdates = await stateUpdateRepository.getPendingStateUpdates(
        addr,
        wholeRange
      )
      for (const su of sus.concat(pendingStateUpdates)) {
        const res = await this.apiClient.spentProof(
          su.depositContractAddress,
          su.blockNumber,
          su.range
        )
        const spentProofs: IncludedTransaction[] = res.data.data.map(tx =>
          IncludedTransaction.fromStruct(
            coder.decode(
              IncludedTransaction.getParamType(),
              Bytes.fromHexString(tx)
            )
          )
        )
        for (const includedTx of spentProofs) {
          // TODO: verify that the tx spent state update
          await stateUpdateRepository.removeVerifiedStateUpdate(
            addr,
            includedTx.range
          )
          const tokenContractAddress = this.tokenManager.getTokenContractAddress(
            addr
          )
          if (tokenContractAddress === undefined) {
            throw new Error('token address not found')
          }
          const actionRepository = await UserActionRepository.init(
            this.witnessDb
          )
          const sentBlockNumber = includedTx.includedBlockNumber
          const action = createSendUserAction(
            Address.from(tokenContractAddress),
            includedTx.range,
            StateObjectHelper.getOwner(includedTx.stateObject),
            sentBlockNumber
          )
          await actionRepository.insertAction(
            sentBlockNumber,
            includedTx.range,
            action
          )

          this.ee.emit(UserActionEvent.SEND, action)
          this.ee.emit(EmitterEvent.TRANSFER_COMPLETE, su)
        }
      }
    }
  }

  /**
   * sync latest state
   * @param blockNumber
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
    await this.storeRoot(blockNumber, root)
    const stateUpdateRepository = await StateUpdateRepository.init(
      this.witnessDb
    )

    try {
      const res = await this.apiClient.syncState(address.data)
      const stateUpdates: StateUpdate[] = res.data.map((s: string) =>
        decodeStructable(StateUpdate, coder, Bytes.fromHexString(s))
      )
      // if aggregator latest state doesn't have client state, client should check spending proof
      // clear verified state updates
      await this.syncTransfers()

      const verifyStateUpdate = async (su: StateUpdate, retryTimes = 5) => {
        try {
          await this.syncRootUntil(blockNumber)
          await prepareCheckpointWitness(su, this.apiClient, this.witnessDb)
          const verified = await verifyCheckpoint(
            this.witnessDb,
            this.deciderManager,
            su
          )
          if (!verified.decision) {
            // retry verification
            if (retryTimes > 0) {
              await sleep(this.retryInterval)
              await verifyStateUpdate(su, retryTimes - 1)
            }
            return
          }
        } catch (e) {
          console.log(e)
        }
        await stateUpdateRepository.insertVerifiedStateUpdate(su)
        const tokenContractAddress = this.tokenManager.getTokenContractAddress(
          su.depositContractAddress
        )
        if (!tokenContractAddress)
          throw new Error('Token Contract Address not found')
        const action = createReceiveUserAction(
          Address.from(tokenContractAddress),
          su.range,
          getOwner(su),
          su.blockNumber
        )
        const actionRepository = await UserActionRepository.init(this.witnessDb)
        await actionRepository.insertAction(su.blockNumber, su.range, action)

        this.ee.emit(UserActionEvent.RECIEVE, action)
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
    const syncRepository = await SyncRepository.init(this.witnessDb)
    const synced = await syncRepository.getSyncedBlockNumber()
    if (JSBI.greaterThanOrEqual(synced.data, blockNumber.data)) {
      console.log(`already synced: Block{${blockNumber.raw}}`)
      return
    }
    console.log(`syncing state: Block{${blockNumber.raw}}`)
    this.ee.emit(EmitterEvent.SYNC_STARTED, blockNumber)
    const stateUpdateRepository = await StateUpdateRepository.init(
      this.witnessDb
    )
    await this.storeRoot(blockNumber, root)

    try {
      const res = await this.apiClient.syncState(address.data, blockNumber)
      const stateUpdates: StateUpdate[] = res.data.map((s: string) =>
        decodeStructable(StateUpdate, coder, Bytes.fromHexString(s))
      )
      await this.syncTransfers()

      await Promise.all(
        stateUpdates.map(async su => {
          try {
            await prepareCheckpointWitness(su, this.apiClient, this.witnessDb)
            const verified = await verifyCheckpoint(
              this.witnessDb,
              this.deciderManager,
              su
            )
            if (!verified.decision) return
          } catch (e) {
            console.log(e)
          }

          await stateUpdateRepository.insertVerifiedStateUpdate(su)
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
      await syncRepository.updateSyncedBlockNumber(blockNumber)
      await syncRepository.insertBlockRoot(blockNumber, root)

      this.ee.emit(EmitterEvent.SYNC_FINISHED, blockNumber)
    } catch (e) {
      console.error(`Failed syncing state: Block{${blockNumber.raw}}`, e)
    }
  }
}
