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
import {
  IncludedTransaction,
  StateUpdate,
  StateUpdateWithFrom
} from '@cryptoeconomicslab/plasma'
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

      const chunkTxMap = new Map<string, Array<IncludedTransaction>>()

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

          // push to chunkId=>su map
          const chunkKey = includedTx.chunkId.toHexString()
          const txList = chunkTxMap.get(chunkKey) || []
          if (
            txList.findIndex(tx => tx.range.equals(includedTx.range)) === -1
          ) {
            txList.push(includedTx)
            chunkTxMap.set(chunkKey, txList)
          }
        }
      }
      const actionRepository = await UserActionRepository.init(this.witnessDb)
      const tokenContractAddress = this.tokenManager.getTokenContractAddress(
        addr
      )
      if (!tokenContractAddress) {
        throw new Error('token address not found')
      }
      for (const chunkId of chunkTxMap.keys()) {
        const txs = chunkTxMap.get(chunkId)
        if (!txs) continue
        const tx = txs[0]

        const sentBlockNumber = tx.includedBlockNumber
        const action = createSendUserAction(
          Address.from(tokenContractAddress),
          txs.map(tx => tx.range),
          StateObjectHelper.getOwner(tx.stateObject),
          sentBlockNumber,
          tx.chunkId
        )

        await actionRepository.insertAction(sentBlockNumber, tx.range, action)

        this.ee.emit(UserActionEvent.SEND, action)
      }
    }
  }

  /**
   * take away exit state updates from verified state updates.
   */
  private async removeAlreadyExitStartedStateUpdates() {
    const stateUpdateRepository = await StateUpdateRepository.init(
      this.witnessDb
    )
    const wholeRange = new Range(BigNumber.from(0), BigNumber.MAX_NUMBER)
    for (const addr of this.tokenManager.depositContractAddresses) {
      const exitStateUpdates = await stateUpdateRepository.getExitStateUpdates(
        addr,
        wholeRange
      )
      for (const su of exitStateUpdates) {
        await stateUpdateRepository.removeVerifiedStateUpdate(addr, su.range)
      }
    }
  }

  /**
   * sync latest state
   * @param blockNumber
   * @param address
   */
  public async syncLatest(to: BigNumber, address: Address) {
    const { coder } = ovmContext
    const syncRepository = await SyncRepository.init(this.witnessDb)
    const synced = await syncRepository.getSyncedBlockNumber()
    if (JSBI.greaterThanOrEqual(synced.data, to.data)) {
      console.log(`already synced: Block{${to.raw}}`)
      return
    }
    const from = synced.increment()
    console.log(`syncing latest state: Block{${to.raw}}`)
    this.ee.emit(EmitterEvent.SYNC_BLOCKS_STARTED, {
      from,
      to
    })
    const stateUpdateRepository = await StateUpdateRepository.init(
      this.witnessDb
    )

    try {
      const res = await this.apiClient.syncState(address.data)
      const stateUpdates: StateUpdateWithFrom[] = res.data.map((s: string) =>
        decodeStructable(StateUpdateWithFrom, coder, Bytes.fromHexString(s))
      )

      // if aggregator latest state doesn't have client state, client should check spending proof
      // clear verified state updates
      await this.syncTransfers()
      //  sync root hashes from `from` to `to`
      await this.syncRoots(from, to)

      const incomingStateUpdatesMap = new Map<
        string,
        Array<StateUpdateWithFrom>
      >()
      for (const suw of stateUpdates) {
        const su = suw.toStateUpdate()
        await prepareCheckpointWitness(su, this.apiClient, this.witnessDb)
        const verified = await verifyCheckpoint(
          this.witnessDb,
          this.deciderManager,
          su
        )
        if (!verified.decision) {
          throw new Error(`invalid history detected at ${su.toString()}`)
        }
        await stateUpdateRepository.insertVerifiedStateUpdate(su)
        const key = su.chunkId.toHexString()
        const chunkList = incomingStateUpdatesMap.get(key) || []
        chunkList.push(suw)
        incomingStateUpdatesMap.set(key, chunkList)
      }

      for (const chunkId of incomingStateUpdatesMap.keys()) {
        const sus = incomingStateUpdatesMap.get(chunkId)
        if (!sus) continue
        const su = sus[0]

        const tokenContractAddress = this.tokenManager.getTokenContractAddress(
          su.depositContractAddress
        )
        if (!tokenContractAddress)
          throw new Error('Token Contract Address not found')

        const action = createReceiveUserAction(
          Address.from(tokenContractAddress),
          sus.map(su => su.range),
          su.from,
          su.blockNumber,
          su.chunkId
        )
        const actionRepository = await UserActionRepository.init(this.witnessDb)
        await actionRepository.insertAction(su.blockNumber, su.range, action)

        this.ee.emit(UserActionEvent.RECIEVE, action)
      }

      this.removeAlreadyExitStartedStateUpdates()

      await syncRepository.updateSyncedBlockNumber(to)

      this.ee.emit(EmitterEvent.SYNC_BLOCKS_FINISHED, { from, to })
    } catch (e) {
      console.error(`Failed syncing state: Block{${to.raw}}`, e)
    }
  }

  /**
   * sync Merkle Root from `from` number to `to` number.
   * @param from
   * @param to
   */
  private async syncRoots(from: BigNumber, to: BigNumber) {
    let b = from
    while (JSBI.lessThanOrEqual(b.data, to.data)) {
      const root = await this.commitmentContract.getRoot(b)
      await this.storeRoot(b, root)
      b = b.increment()
    }
  }

  private async storeRoot(blockNumber: BigNumber, root: FixedBytes) {
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
    const syncRepository = await SyncRepository.init(this.witnessDb)
    await syncRepository.insertBlockRoot(blockNumber, root)
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
    this.ee.emit(EmitterEvent.SYNC_BLOCK_STARTED, blockNumber)
    const stateUpdateRepository = await StateUpdateRepository.init(
      this.witnessDb
    )
    await this.storeRoot(blockNumber, root)

    try {
      const res = await this.apiClient.syncState(address.data, blockNumber)
      const stateUpdates: StateUpdateWithFrom[] = res.data.map((s: string) =>
        decodeStructable(StateUpdateWithFrom, coder, Bytes.fromHexString(s))
      )
      await this.syncTransfers()

      // map from chunkId to array of stateUpdate
      const incomingStateUpdatesMap = new Map<
        string,
        Array<StateUpdateWithFrom>
      >()

      for (const suw of stateUpdates) {
        const su = suw.toStateUpdate()

        await prepareCheckpointWitness(su, this.apiClient, this.witnessDb)
        const verified = await verifyCheckpoint(
          this.witnessDb,
          this.deciderManager,
          su
        )
        if (!verified.decision) {
          throw new Error(`invalid history detected at ${su.toString()}`)
        }

        await stateUpdateRepository.insertVerifiedStateUpdate(su)
        // store receive user action
        const tokenContractAddress = this.tokenManager.getTokenContractAddress(
          su.depositContractAddress
        )
        if (!tokenContractAddress)
          throw new Error('Token Contract Address not found')

        const key = su.chunkId.toHexString()
        const chunkList = incomingStateUpdatesMap.get(key) || []
        chunkList.push(suw)
        incomingStateUpdatesMap.set(key, chunkList)
      }

      const actionRepository = await UserActionRepository.init(this.witnessDb)

      for (const chunkId of incomingStateUpdatesMap.keys()) {
        const sus = incomingStateUpdatesMap.get(chunkId)
        if (!sus) continue
        const su = sus[0]
        const tokenContractAddress = this.tokenManager.getTokenContractAddress(
          su.depositContractAddress
        )
        if (!tokenContractAddress)
          throw new Error('Token Contract Address not found')

        const action = createReceiveUserAction(
          Address.from(tokenContractAddress),
          sus.map(su => su.range),
          su.from,
          su.blockNumber,
          su.chunkId
        )

        await actionRepository.insertAction(su.blockNumber, su.range, action)
        this.ee.emit(UserActionEvent.RECIEVE, action)
      }

      await syncRepository.updateSyncedBlockNumber(blockNumber)

      this.ee.emit(EmitterEvent.SYNC_BLOCK_FINISHED, blockNumber)
    } catch (e) {
      console.error(`Failed syncing state: Block{${blockNumber.raw}}`, e)
    }
  }
}
