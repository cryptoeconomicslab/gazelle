import { Bytes } from '@cryptoeconomicslab/primitives'
import { StateUpdate } from '@cryptoeconomicslab/plasma'
import { DoubleLayerInclusionProof } from '@cryptoeconomicslab/merkle-tree'
import { ExitChallenge } from '@cryptoeconomicslab/plasma'

/**
 * ExitDispute contract interface
 */
export interface IExitDisputeContract {
  claim(
    stateUpdate: StateUpdate,
    inclusionProof: DoubleLayerInclusionProof
  ): Promise<void>

  challenge(challenge: ExitChallenge): Promise<void>

  removeChallenge(challenge: ExitChallenge, witness: Bytes[]): Promise<void>

  settle(stateUpdate: StateUpdate): Promise<void>

  subscribeExitClaimed(
    handler: (
      stateUpdate: StateUpdate,
      inclusionProof: DoubleLayerInclusionProof
    ) => void
  ): void
  subscribeExitChallenged(
    handler: (stateUpdate: StateUpdate, challenge: ExitChallenge) => void
  ): void
  subscribeExitChallengeRemoved(
    handler: (stateUpdate: StateUpdate, challenge: ExitChallenge) => void
  ): void
  subscribeExitSettled(handler: (stateUpdate: StateUpdate) => void): void
}
