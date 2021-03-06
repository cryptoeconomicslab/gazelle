import { StateUpdate, Transaction } from '.'
import { DoubleLayerInclusionProof } from '@cryptoeconomicslab/merkle-tree'
import { Bytes } from '@cryptoeconomicslab/primitives'

export enum EXIT_CHALLENGE_TYPE {
  CHECKPOINT = 'EXIT_CHECKPOINT_CHALLENGE',
  SPENT = 'EXIT_SPENT_CHALLENGE'
}

export type CheckpointChallenge = {
  type: EXIT_CHALLENGE_TYPE.CHECKPOINT
  stateUpdate: StateUpdate
  challengeStateUpdate: StateUpdate
  inclusionProof: DoubleLayerInclusionProof
}
export type SpentChallenge = {
  type: EXIT_CHALLENGE_TYPE.SPENT
  stateUpdate: StateUpdate
  transaction: Transaction
  witness: Bytes[]
}

export type ExitChallenge = CheckpointChallenge | SpentChallenge

export function createSpentChallenge(
  stateUpdate: StateUpdate,
  transaction: Transaction,
  witness: Bytes[]
): SpentChallenge {
  return {
    type: EXIT_CHALLENGE_TYPE.SPENT,
    stateUpdate,
    transaction,
    witness
  }
}

export function createCheckpointChallenge(
  stateUpdate: StateUpdate,
  challengeStateUpdate: StateUpdate,
  inclusionProof: DoubleLayerInclusionProof
): CheckpointChallenge {
  return {
    type: EXIT_CHALLENGE_TYPE.CHECKPOINT,
    stateUpdate,
    challengeStateUpdate,
    inclusionProof
  }
}
