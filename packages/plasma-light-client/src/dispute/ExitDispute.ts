import { Property, Bytes } from '@cryptoeconomicslab/primitives'
import { StateUpdate } from '@cryptoeconomicslab/plasma'
import { DeciderManager } from '@cryptoeconomicslab/ovm'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import { TransactionRepository, InclusionProofRepository } from '../repository'

interface ExitDisputeContract {
  claim(inputs: Bytes[], witnesses: Bytes[]): Promise<void>
  challenge(
    inputs: Bytes[],
    challengeInputs: Bytes[],
    witnesses: Bytes[]
  ): Promise<void>
  subscribeExitClaim(handler: (stateUpdate: StateUpdate) => Promise<void>): void
  subscribeExitChallenged(
    handler: (stateUpdate: StateUpdate) => Promise<void>
  ): void
  subscribeExitSettled(
    handler: (stateUpdate: StateUpdate) => Promise<void>
  ): void
}

export class ExitDispte {
  constructor(
    private contract: ExitDisputeContract,
    private deciderManager: DeciderManager,
    private witnessDb: KeyValueStore
  ) {
    // watch exit contract to handle challenge
    this.contract.subscribeExitClaim(this.handleExitClaimed)
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

    const { coder } = ovmContext
    this.contract.claim(
      [coder.encode(stateUpdate.property.toStruct())],
      [coder.encode(inclusionProofs[0].toStruct())]
    )
  }

  /**
   * @name handleExitClaimed
   * @description handle ExitClaimed event from ExitDispute contract
   * @param stateUpdate
   */
  async handleExitClaimed(stateUpdate: StateUpdate) {
    const txRepo = await TransactionRepository.init(this.witnessDb)
    // challenge
    // check that a transaction is exists
    const transactions = await txRepo.getTransactions(
      stateUpdate.depositContractAddress,
      stateUpdate.blockNumber,
      stateUpdate.range
    )
    if (transactions.length === 0) {
      console.warn('tx not fonud')
      return
    }

    const { coder } = ovmContext
    const tx = coder.encode(transactions[0].body)
    const stateObject = new Property(
      stateUpdate.stateObject.deciderAddress,
      stateUpdate.stateObject.inputs.concat([tx])
    )
    const decision = await this.deciderManager.decide(stateObject, {})

    // TODO: call Checkpoint.handleCheckpointClaimed(stateUpdate)
    if (decision.outcome) {
      await this.contract.challenge(
        [coder.encode(stateUpdate.property.toStruct())],
        [],
        [tx]
      )
    }
  }

  async handleExitChallenged(stateUpdate: StateUpdate) {}
  async handleExitSettled(stateUpdate: StateUpdate) {}
}
