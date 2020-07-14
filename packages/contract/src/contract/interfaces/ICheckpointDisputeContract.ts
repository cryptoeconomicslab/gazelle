import { Bytes } from '@cryptoeconomicslab/primitives'
import { StateUpdate } from '@cryptoeconomicslab/plasma'
import { DoubleLayerInclusionProof } from '@cryptoeconomicslab/merkle-tree'

/**
 * CheckpointDispute contract interface
 */
export interface ICheckpointDisputeContract {
  claim(
    stateUpdate: StateUpdate,
    inclusionProof: DoubleLayerInclusionProof
  ): Promise<void>

  challenge(
    stateUpdate: StateUpdate,
    challenge: StateUpdate,
    inclusionProof: DoubleLayerInclusionProof
  ): Promise<void>

  removeChallenge(
    stateUpdate: StateUpdate,
    challenge: StateUpdate,
    witness: Bytes[]
  ): Promise<void>

  settle(stateUpdate: StateUpdate): Promise<void>

  subscribeCheckpointClaimed(
    handler: (
      stateUpdate: StateUpdate,
      inclusionProof: DoubleLayerInclusionProof
    ) => void
  ): void
  subscribeCheckpointChallenged(
    handler: (
      stateUpdate: StateUpdate,
      challenge: StateUpdate,
      inclusionProof: DoubleLayerInclusionProof
    ) => void
  ): void
  subscribeCheckpointChallengeRemoved(
    handler: (stateUpdate: StateUpdate, challenge: StateUpdate) => void
  ): void
  subscribeCheckpointSettled(handler: (stateUpdate: StateUpdate) => void): void
}
