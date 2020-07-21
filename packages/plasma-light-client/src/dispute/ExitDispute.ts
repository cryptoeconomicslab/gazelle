import { Property } from '@cryptoeconomicslab/primitives'
import {
  StateUpdate,
  createSpentChallenge,
  createCheckpointChallenge,
  SpentChallenge,
  CheckpointChallenge
} from '@cryptoeconomicslab/plasma'
import { DeciderManager } from '@cryptoeconomicslab/ovm'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import { IExitDisputeContract } from '@cryptoeconomicslab/contract'
import {
  StateUpdateRepository,
  TransactionRepository,
  InclusionProofRepository
} from '../repository'
import { verifyCheckpoint } from '../verifier/CheckpointVerifier'

export class ExitDispute {
  constructor(
    private contract: IExitDisputeContract,
    private deciderManager: DeciderManager,
    private witnessDb: KeyValueStore
  ) {
    // watch exit contract to handle challenge
    this.contract.subscribeExitClaimed(this.handleExitClaimed)
    this.contract.subscribeExitChallenged(this.handleExitChallenged)
    this.contract.subscribeExitSettled(this.handleExitSettled)
  }

  /**
   * @name claimExit
   * @description claims "exiting a StateUpdate" to ExitDispute contract
   * @param stateUpdate A StateUpdate to exit
   */
  async claimExit(stateUpdate: StateUpdate) {
    const repo = await InclusionProofRepository.init(this.witnessDb)
    const inclusionProofs = await repo.getInclusionProofs(
      stateUpdate.depositContractAddress,
      stateUpdate.blockNumber,
      stateUpdate.range
    )
    if (inclusionProofs.length !== 1) {
      throw new Error(
        `Inclusion proof not found for stateUpdate: ${stateUpdate.toString()}`
      )
    }

    this.contract.claim(stateUpdate, inclusionProofs[0])
  }

  /**
   * @name handleExitClaimed
   * @description handle ExitClaimed event from ExitDispute contract.
   * if exiting range includes client owning stateUpdate, check if it's spent or checkpoint and
   * claim challenge to ExitDispute contract.
   * @param stateUpdate
   */
  async handleExitClaimed(stateUpdate: StateUpdate) {
    const suRepo = await StateUpdateRepository.init(this.witnessDb)

    // check if claimed stateUpdate is same range and greater blockNumber of owning stateUpdate
    const stateUpdates = await suRepo.getVerifiedStateUpdates(
      stateUpdate.depositContractAddress,
      stateUpdate.range
    )
    if (stateUpdates.length === 0) return

    const checkpointChallenge = await this.checkCheckpointChallenge(stateUpdate)
    if (checkpointChallenge) {
      await this.contract.challenge(checkpointChallenge)
      return
    }

    const spentChallenge = await this.checkSpentChallenge(stateUpdate)
    if (spentChallenge) {
      await this.contract.challenge(spentChallenge)
      return
    }
  }

  async handleExitChallenged(stateUpdate: StateUpdate) {}
  async handleExitSettled(stateUpdate: StateUpdate) {}

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

    const { coder } = ovmContext
    const tx = coder.encode(transactions[0].body)
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
