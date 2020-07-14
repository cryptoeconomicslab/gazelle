import { Bytes } from '@cryptoeconomicslab/primitives'
import { ICheckpointDisputeContract } from '@cryptoeconomicslab/contract'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import { StateUpdate } from '@cryptoeconomicslab/plasma'
import { DoubleLayerInclusionProof } from '@cryptoeconomicslab/merkle-tree'

type CheckpointDecision =
  | { decision: true }
  | { decision: false; challenge: CheckpointChallenge }

interface CheckpointChallenge {
  stateUpdate: StateUpdate
  challenge: StateUpdate
  witness: DoubleLayerInclusionProof
}

/**
 * CheckpointDispute class used by Plasma Light Client responsible for following activities
 * - claim checkpoint when necessary
 * - watch checkpoint dispute contract
 * - challenge checkpoint claim when necessary
 * - removeChallenge checkpoint challenge when necessary
 * - settle checkpoint when possible
 * - polling to settle claimed checkpoint if this client claimed a checkpoint
 */
export class CheckpointDispute {
  constructor(
    private contract: ICheckpointDisputeContract,
    private witnessDb: KeyValueStore
  ) {
    contract.subscribeCheckpointClaimed(this.handleCheckpointClaimed)
    contract.subscribeCheckpointChallenged(this.handleCheckpointChallenged)
    contract.subscribeCheckpointChallengeRemoved(this.handleChallengeRemoved)
    contract.subscribeCheckpointSettled(this.handleCheckpointSettled)
  }

  /**
   * check if checkpoint can be created at given stateUpdate
   * if not, returns false and challenge inputs and witness
   * @param stateUpdate to create checkpoint
   */
  public async evaluate(stateUpdate: StateUpdate): Promise<CheckpointDecision> {
    // TODO: implement
    return { decision: true }
  }

  private handleCheckpointClaimed(
    stateUpdate: StateUpdate,
    inclusionProof: DoubleLayerInclusionProof
  ) {
    // challenge if claimed stateUpdate is same range but greater blockNumber
    // than client owning stateUpdate
    console.log(
      'checkpoint claim detected. check the validity and challenge if invalid'
    )
  }

  private handleCheckpointChallenged(
    stateUpdate: StateUpdate,
    challenge: StateUpdate,
    inclusionProof: DoubleLayerInclusionProof
  ) {
    // immediately call removeChallenge if your claim is challenged and you have witness to remove it
    console.log(
      'checkpoint challenged. check the validity and remove with witness'
    )
  }

  private handleChallengeRemoved(
    stateUpdate: StateUpdate,
    challenge: StateUpdate
  ) {
    // you can do nothing. challenge is just removed
    console.log('checkpoint challenge removed')
  }

  private handleCheckpointSettled(stateUpdate: StateUpdate) {
    // store settled checkpoint
    console.log('checkpoint settled')
  }

  /**
   * polling claim if there remains claims not settled, do polling
   * stop polling when no claims remains.
   */
  private pollClaim() {}

  /**
   * claim checkpoint.
   * LightClient does not call checkpoint from this method in ordinaly case
   */
  public async claim(
    stateUpdate: StateUpdate,
    inclusionProof: DoubleLayerInclusionProof
  ) {
    await this.contract.claim(stateUpdate, inclusionProof)
  }

  /**
   * challenge to checkpoint
   */
  public async challenge(
    stateUpdate: StateUpdate,
    challenge: StateUpdate,
    inclusionProof: DoubleLayerInclusionProof
  ) {
    await this.contract.challenge(stateUpdate, challenge, inclusionProof)
  }

  /**
   * remove challenge by submitting witness
   */
  public async removeChallenge(
    stateUpdate: StateUpdate,
    challenge: StateUpdate,
    witness: Bytes[]
  ) {
    await this.contract.removeChallenge(stateUpdate, challenge, witness)
  }

  /**
   * settle checkpoint claim
   */
  public async settle(stateUpdate: StateUpdate) {
    await this.contract.settle(stateUpdate)
  }
}
