import JSBI from 'jsbi'
import EventEmitter from 'event-emitter'
import { Address } from '@cryptoeconomicslab/primitives'
import { Exit } from '@cryptoeconomicslab/plasma'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import { Numberish } from '../types'
import TokenManager from '../managers/TokenManager'
import {
  StateUpdateRepository,
  SyncRepository,
  ExitRepository,
  DepositedRangeRepository,
  UserActionRepository
} from '../repository'
import { EmitterEvent } from '../ClientEvent'
import { ExitDispute } from '../dispute/ExitDispute'
import { IOwnershipPayoutContract } from '@cryptoeconomicslab/contract'
import { createExitUserAction } from '../UserAction'

export class ExitUsecase {
  constructor(
    private ee: EventEmitter,
    private witnessDb: KeyValueStore,
    private tokenManager: TokenManager,
    private exitDispute: ExitDispute,
    private ownershipPayoutContract: IOwnershipPayoutContract
  ) {}

  /**
   * Withdrawal process starts from calling this method.
   * Given amount and tokenContractAddress, checks if client has sufficient token amount.
   * If client has sufficient amount, create exitProperty from stateUpdates this client owns,
   * calls `claimProperty` method on UniversalAdjudicationContract. Store the property in exitList.
   * User can call `completeWithdrawal` to withdraw actual token after the exitProperty is decided to true on-chain.
   * @param amount amount to exit
   * @param tokenContractAddress token contract address to exit
   */
  public async startWithdrawal(
    amount: Numberish,
    tokenContractAddress: string
  ) {
    const syncRepo = await SyncRepository.init(this.witnessDb)
    const claimedBlockNumber = await syncRepo.getNextBlockNumber()

    const addr = Address.from(tokenContractAddress)
    const depositContractAddress = this.tokenManager.getDepositContractAddress(
      addr
    )
    if (!depositContractAddress) {
      throw new Error('Deposit Contract Address not found')
    }
    const stateUpdateRepository = await StateUpdateRepository.init(
      this.witnessDb
    )

    const stateUpdates = await stateUpdateRepository.resolveStateUpdate(
      Address.from(depositContractAddress),
      JSBI.BigInt(amount)
    )
    if (Array.isArray(stateUpdates) && stateUpdates.length > 0) {
      // resolve promises in sequence to avoid an error of ethers.js on calling claimProperty
      // "the tx doesn't have the correct nonce."
      for (const stateUpdate of stateUpdates) {
        // TODO: need to rollback if part of stateUpdates fails.
        await this.exitDispute.claimExit(stateUpdate)
        await stateUpdateRepository.insertExitStateUpdate(stateUpdate)
        await stateUpdateRepository.removeVerifiedStateUpdate(
          stateUpdate.depositContractAddress,
          stateUpdate.range
        )
        // save exit action
        const action = createExitUserAction(
          addr,
          stateUpdate.range,
          claimedBlockNumber
        )
        const repo = await UserActionRepository.init(this.witnessDb)
        await repo.insertAction(claimedBlockNumber, stateUpdate.range, action)
      }
    } else {
      throw new Error('Insufficient amount')
    }
  }

  /**
   * Given exit instance, finalize exit to withdraw token from deposit contract.
   * Client checks if the exitProperty of the exit instance is decided by calling `isDecided` method
   * of UniversalAdjudicationContract. If the property claim have not been decided yet, call `decideClaimToTrue`.
   * If the exitProperty had been decided to true, call `finalizeExit` method of corresponding payout contract.
   *
   * @param exit Exit object to finalize
   * @param address Address to exit on chain
   */
  public async completeWithdrawal(exit: Exit, address: Address) {
    // const syncRepo = await SyncRepository.init(this.witnessDb)
    // const currentBlockNumber = await syncRepo.getSyncedBlockNumber()

    // TODO: check claim can be settled. call `disputeManager.canSettle()`
    // if (
    //   JSBI.greaterThan(
    //     JSBI.add(exit.claimedBlockNumber.data, JSBI.BigInt(1)),
    //     currentBlockNumber.data
    //   )
    // ) {
    //   throw new Error('Exit dispute period have not been passed')
    // }

    await this.exitDispute.settle(exit)

    const depositedRangeRepository = await DepositedRangeRepository.init(
      this.witnessDb
    )
    const depositedRangeId = await depositedRangeRepository.getDepositedRangeId(
      exit.stateUpdate.depositContractAddress,
      exit.stateUpdate.range
    )
    await this.ownershipPayoutContract.finalizeExit(
      exit.stateUpdate.depositContractAddress,
      exit.stateUpdate,
      depositedRangeId,
      address
    )

    this.ee.emit(EmitterEvent.EXIT_FINALIZED, exit.stateUpdate)
  }

  /**
   * Get pending withdrawal list
   */
  public async getPendingWithdrawals(): Promise<Exit[]> {
    const exitRepo = await ExitRepository.init(this.witnessDb)
    const exits = await Promise.all(
      this.tokenManager.depositContractAddresses.map(async addr => {
        return await exitRepo.getAllClaimedExits(addr)
      })
    )

    return ([] as Exit[]).concat(...exits)
  }
}
