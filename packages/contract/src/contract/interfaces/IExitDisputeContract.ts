import { Bytes } from '@cryptoeconomicslab/primitives'
import { StateUpdate } from '@cryptoeconomicslab/plasma'
import { DoubleLayerInclusionProof } from '@cryptoeconomicslab/merkle-tree'
import { ExitChallenge, EXIT_CHALLENGE_TYPE } from '@cryptoeconomicslab/plasma'

/**
 * ExitDispute contract interface
 */
export interface IExitDisputeContract {
  claim(
    stateUpdate: StateUpdate,
    inclusionProof: DoubleLayerInclusionProof
  ): Promise<void>

  claimExitCheckpoint(
    stateUpdate: StateUpdate,
    checkpoint: StateUpdate
  ): Promise<void>

  challenge(challenge: ExitChallenge): Promise<void>

  removeChallenge(
    stateUpdate: StateUpdate,
    challenge: StateUpdate,
    witness: Bytes[]
  ): Promise<void>

  settle(stateUpdate: StateUpdate): Promise<void>

  getClaimDecision(stateUpdate: StateUpdate): Promise<number>

  subscribeExitClaimed(handler: (stateUpdate: StateUpdate) => void): void
  subscribeExitChallenged(
    handler: (
      challengeType: EXIT_CHALLENGE_TYPE,
      stateUpdate: StateUpdate,
      challengeStateUpdate?: StateUpdate
    ) => void
  ): void
  subscribeExitChallengeRemoved(
    handler: (
      stateUpdate: StateUpdate,
      challengeStateUpdate: StateUpdate
    ) => void
  ): void
  subscribeExitSettled(
    handler: (stateUpdate: StateUpdate, decision: boolean) => void
  ): void

  startWatchingEvents(): void

  unsubscribeAll(): void
}
