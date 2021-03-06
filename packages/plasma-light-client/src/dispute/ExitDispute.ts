import { Property, Address } from '@cryptoeconomicslab/primitives'
import {
  StateUpdate,
  createSpentChallenge,
  createCheckpointChallenge,
  SpentChallenge,
  CheckpointChallenge,
  EXIT_CHALLENGE_TYPE,
  Exit
} from '@cryptoeconomicslab/plasma'
import { hint as Hint, DeciderManager } from '@cryptoeconomicslab/ovm'
import { KeyValueStore, getWitnesses } from '@cryptoeconomicslab/db'
import { IExitDisputeContract } from '@cryptoeconomicslab/contract'
import APIClient from '../APIClient'
import {
  StateUpdateRepository,
  TransactionRepository,
  InclusionProofRepository,
  ExitRepository,
  SyncRepository,
  CheckpointRepository,
  UserActionRepository
} from '../repository'
import { verifyCheckpoint } from '../verifier/CheckpointVerifier'
import { prepareCheckpointWitness } from '../helper/checkpointWitnessHelper'
import { createExitUserAction } from '../UserAction'
import TokenManager from '../managers/TokenManager'
import { getOwner } from '../helper/stateUpdateHelper'

export class ExitDispute {
  constructor(
    private owner: Address,
    private contract: IExitDisputeContract,
    private witnessDb: KeyValueStore,
    private deciderManager: DeciderManager,
    private apiClient: APIClient,
    private tokenManager: TokenManager
  ) {
    // watch exit contract to handle challenge
    this.contract.subscribeExitClaimed(this.handleExitClaimed.bind(this))
    this.contract.subscribeExitChallenged(this.handleExitChallenged.bind(this))
    this.contract.subscribeExitSettled(this.handleExitSettled.bind(this))
  }

  public startWatchingEvents() {
    this.contract.startWatchingEvents()
  }

  /**
   * @name claimExit
   * @description claims "exiting a StateUpdate" to ExitDispute contract
   * @param stateUpdate A StateUpdate to exit
   */
  public async claimExit(stateUpdate: StateUpdate) {
    // store exiting stateUpdate in ExitRepository
    const inclusionProofRepo = await InclusionProofRepository.init(
      this.witnessDb
    )
    const inclusionProofs = await inclusionProofRepo.getInclusionProofs(
      stateUpdate.depositContractAddress,
      stateUpdate.blockNumber,
      stateUpdate.range
    )
    if (inclusionProofs.length === 0) {
      const checkpointRepo = await CheckpointRepository.init(this.witnessDb)
      const checkpoints = await checkpointRepo.getSettledCheckpoints(
        stateUpdate.depositContractAddress,
        stateUpdate.range
      )
      if (checkpoints.length === 0) {
        throw new Error(
          `Inclusion proof not found for stateUpdate: ${stateUpdate.toString()}`
        )
      }
      if (checkpoints[0].blockNumber.equals(stateUpdate.blockNumber)) {
        // TODO: check if checkpoints[0] contains stateUpdate
        // TODO: if different checkpoint exists for the stateUpdate
        const checkpoint = checkpoints[0]
        console.log('claimExit for checkpoint: ', checkpoint.hash.toHexString())
        await this.contract.claimExitCheckpoint(stateUpdate, checkpoint)
      }
    } else {
      await this.contract.claim(stateUpdate, inclusionProofs[0])
    }
  }

  /**
   * settle ClaimedExit by calling settle method
   * @param exit Exit object to settle
   */
  public async settle(exit: Exit) {
    await this.contract.settle(exit.stateUpdate)
    const exitRepo = await ExitRepository.init(this.witnessDb)
    await exitRepo.removeClaimedExit(exit)
    await exitRepo.insertSettledExit(exit.stateUpdate)
  }

  public async getClaimDecision(stateUpdate: StateUpdate): Promise<number> {
    return await this.contract.getClaimDecision(stateUpdate)
  }

  /**
   * @name handleExitClaimed
   * @description handle ExitClaimed event from ExitDispute contract.
   * if exiting range includes client owning stateUpdate, check if it's spent or checkpoint and
   * claim challenge to ExitDispute contract.
   * @param stateUpdate
   */
  async handleExitClaimed(stateUpdate: StateUpdate) {
    console.log('handle exit claimed')
    const suRepo = await StateUpdateRepository.init(this.witnessDb)
    // sync exit claim
    if (getOwner(stateUpdate).equals(this.owner)) {
      const syncRepo = await SyncRepository.init(this.witnessDb)
      const claimedBlockNumber = await syncRepo.getSyncedBlockNumber()
      const exit = new Exit(stateUpdate, claimedBlockNumber)
      const exitRepo = await ExitRepository.init(this.witnessDb)
      await exitRepo.insertClaimedExit(exit)

      // sync state
      await suRepo.insertExitStateUpdate(stateUpdate)
      await suRepo.removeVerifiedStateUpdate(
        stateUpdate.depositContractAddress,
        stateUpdate.range
      )
    }

    // check if claimed stateUpdate is same range and greater blockNumber of owning stateUpdate
    const stateUpdates = await suRepo.getVerifiedStateUpdates(
      stateUpdate.depositContractAddress,
      stateUpdate.range
    )
    if (stateUpdates.length === 0) return

    await prepareCheckpointWitness(stateUpdate, this.apiClient, this.witnessDb)

    const checkpointChallenge = await this.checkCheckpointChallenge(stateUpdate)
    if (checkpointChallenge) {
      console.log('trying checkpoint challenge', checkpointChallenge)
      await this.contract.challenge(checkpointChallenge)
      return
    }

    const spentChallenge = await this.checkSpentChallenge(stateUpdate)
    if (spentChallenge) {
      try {
        await this.contract.challenge(spentChallenge)
      } catch (e) {
        console.log(e)
      }
      return
    }
  }

  async handleExitChallenged(
    challengeType: EXIT_CHALLENGE_TYPE,
    stateUpdate: StateUpdate,
    challengeStateUpdate?: StateUpdate
  ) {
    if (challengeType === EXIT_CHALLENGE_TYPE.CHECKPOINT) {
      // This never happens
      if (!challengeStateUpdate) return

      // do checkpoint challenged
      const exitRepo = await ExitRepository.init(this.witnessDb)
      const claims = await exitRepo.getClaimedExits(
        stateUpdate.depositContractAddress,
        stateUpdate.range
      )
      if (claims.length === 0) return

      const txRepo = await TransactionRepository.init(this.witnessDb)
      const transactions = await txRepo.getTransactions(
        challengeStateUpdate.depositContractAddress,
        challengeStateUpdate.blockNumber,
        challengeStateUpdate.range
      )
      if (transactions.length !== 1) {
        // do nothing
        return
      }
      const txBytes = transactions[0].message
      const signature = await getWitnesses(
        this.witnessDb,
        Hint.createSignatureHint(txBytes)
      )
      if (signature.length !== 1) {
        // do nothing
        return
      }

      const witness = [txBytes, signature[0]]
      this.contract.removeChallenge(stateUpdate, challengeStateUpdate, witness)
    } else if (challengeType === EXIT_CHALLENGE_TYPE.SPENT) {
      // nothing you can do. Just delete exiting state from stateUpdate
    }
  }

  async handleExitSettled(stateUpdate: StateUpdate, decision: boolean) {
    const repository = await ExitRepository.init(this.witnessDb)
    const claimedExits = await repository.getClaimedExits(
      stateUpdate.depositContractAddress,
      stateUpdate.range
    )
    if (claimedExits.length === 1) {
      const exit = claimedExits[0]
      await repository.removeClaimedExit(exit)
      await repository.insertSettledExit(exit.stateUpdate)
    }

    // sync user action
    // TODO: since exit doesn't have block number, It can't be restored to correct position.
  }

  //// Challenge checker

  private async checkSpentChallenge(
    stateUpdate: StateUpdate
  ): Promise<SpentChallenge | undefined> {
    // spent challenge
    const txRepo = await TransactionRepository.init(this.witnessDb)
    const transactions = await txRepo.getTransactions(
      stateUpdate.depositContractAddress,
      stateUpdate.blockNumber,
      stateUpdate.range
    )
    if (transactions.length === 0) {
      // Witness transaction not found for the stateUpdate. do nothing
      return
    }

    const tx = transactions[0].message
    const stateObject = new Property(
      stateUpdate.stateObject.deciderAddress,
      stateUpdate.stateObject.inputs.concat([tx])
    )

    const spentChallengeResult = await this.deciderManager.decide(
      stateObject,
      {}
    )
    if (!spentChallengeResult.outcome) return

    return createSpentChallenge(
      stateUpdate,
      transactions[0],
      spentChallengeResult.witnesses || []
    )
  }

  public async isCompletable(exit: Exit) {
    return this.contract.isCompletable(exit.stateUpdate)
  }

  private async checkCheckpointChallenge(
    stateUpdate: StateUpdate
  ): Promise<CheckpointChallenge | undefined> {
    // checkpoint challenge
    // TODO: check if witness for claimed range is stored locally
    // TODO: if not, get witness from API

    const checkpointChallengeResult = await verifyCheckpoint(
      this.witnessDb,
      this.deciderManager,
      stateUpdate
    )
    if (
      !checkpointChallengeResult.challenge &&
      checkpointChallengeResult.decision
    )
      return

    const inclusionProofRepo = await InclusionProofRepository.init(
      this.witnessDb
    )
    const challengingStateUpdate = checkpointChallengeResult.challenge as StateUpdate
    const inclusionProofs = await inclusionProofRepo.getInclusionProofs(
      challengingStateUpdate.depositContractAddress,
      challengingStateUpdate.blockNumber,
      challengingStateUpdate.range
    )

    // Inclusion proof does not stored locally. cannot challenge
    if (inclusionProofs.length === 0) return

    return createCheckpointChallenge(
      stateUpdate,
      challengingStateUpdate,
      inclusionProofs[0]
    )
  }
}
