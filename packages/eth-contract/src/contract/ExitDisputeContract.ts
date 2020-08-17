import * as ethers from 'ethers'
import { Bytes, Address, Codable } from '@cryptoeconomicslab/primitives'
import { EventLog } from '@cryptoeconomicslab/contract'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import EthEventWatcher, { EventWatcherOptions } from '../events'
import { StateUpdate } from '@cryptoeconomicslab/plasma'
import { DoubleLayerInclusionProof } from '@cryptoeconomicslab/merkle-tree'
import { IExitDisputeContract } from '@cryptoeconomicslab/contract'
import { ExitChallenge, EXIT_CHALLENGE_TYPE } from '@cryptoeconomicslab/plasma'
import { logToStateUpdate, stateUpdateToLog } from '../helper'
import ABI from '../abi'

function encode(v: Codable) {
  return ovmContext.coder.encode(v).toHexString()
}

function createChallengeInputAndWitness(
  challenge: ExitChallenge
): { challengeInput: string[]; witness: string[] } {
  const { coder } = ovmContext
  if (challenge.type === EXIT_CHALLENGE_TYPE.SPENT) {
    return {
      challengeInput: [
        Bytes.fromString(challenge.type).toHexString(),
        challenge.transaction.message.toHexString()
      ],
      witness: challenge.witness.map(w => w.toHexString())
    }
  } else if (challenge.type === EXIT_CHALLENGE_TYPE.CHECKPOINT) {
    return {
      challengeInput: [
        Bytes.fromString(challenge.type).toHexString(),
        coder.encode(challenge.challengeStateUpdate.toStruct()).toHexString()
      ],
      witness: [coder.encode(challenge.inclusionProof.toStruct()).toHexString()]
    }
  } else {
    throw new Error('Invalid Exit challenge type')
  }
}

/**
 * ExitDispute contract interface
 */
export class ExitDisputeContract implements IExitDisputeContract {
  private connection: ethers.Contract
  private eventWatcher: EthEventWatcher
  readonly gasLimit: number = 800000

  public static abi = [
    // Events
    `event ExitClaimed(${ABI.STATE_UPDATE} stateUpdate)`,
    `event ExitSpentChallenged(${ABI.STATE_UPDATE} stateUpdate)`,
    `event ExitCheckpointChallenged(${ABI.STATE_UPDATE} stateUpdate, ${ABI.STATE_UPDATE} challengingStateUpdate)`,
    `event ChallengeRemoved(${ABI.STATE_UPDATE} stateUpdate, ${ABI.STATE_UPDATE} challengingStateUpdate)`,
    `event ExitSettled(${ABI.STATE_UPDATE} stateUpdate, bool decision)`,

    // methods
    'function claim(bytes[] inputs, bytes[] witness)',
    'function challenge(bytes[] inputs, bytes[] challengeInputs, bytes[] witness)',
    'function removeChallenge(bytes[] inputs, bytes[] challengeInputs, bytes[] witness)',
    'function settle(bytes[] inputs)',
    `function getClaimDecision(${ABI.STATE_UPDATE} su) view returns (uint)`,
    `function isCompletable(${ABI.STATE_UPDATE} su) view returns (bool)`
  ]

  constructor(
    readonly address: Address,
    eventDb: KeyValueStore,
    signer: ethers.Signer,
    provider?: ethers.providers.Provider,
    eventWatcherOptions?: EventWatcherOptions
  ) {
    this.connection = new ethers.Contract(
      address.data,
      ExitDisputeContract.abi,
      signer
    )
    this.eventWatcher = new EthEventWatcher({
      provider: provider || this.connection.provider,
      kvs: eventDb,
      contractAddress: address.data,
      contractInterface: this.connection.interface,
      options: eventWatcherOptions
    })
  }

  public async claim(
    stateUpdate: StateUpdate,
    inclusionProof: DoubleLayerInclusionProof
  ): Promise<void> {
    const tx = await this.connection.claim(
      [encode(stateUpdate.toStruct())],
      [encode(inclusionProof.toStruct())],
      { gasLimit: this.gasLimit }
    )
    await tx.wait()
  }

  public async claimExitCheckpoint(
    stateUpdate: StateUpdate,
    checkpoint: StateUpdate
  ) {
    const tx = await this.connection.claim(
      [encode(stateUpdate.toStruct()), encode(checkpoint.toStruct())],
      [],
      { gasLimit: this.gasLimit }
    )
    await tx.wait()
  }

  public async challenge(challenge: ExitChallenge): Promise<void> {
    const { challengeInput, witness } = createChallengeInputAndWitness(
      challenge
    )

    const tx = await this.connection.challenge(
      [encode(challenge.stateUpdate.toStruct())],
      challengeInput,
      witness,
      { gasLimit: this.gasLimit }
    )
    await tx.wait()
  }

  public async removeChallenge(
    stateUpdate: StateUpdate,
    challengeStateUpdate: StateUpdate,
    witness: Bytes[]
  ): Promise<void> {
    const tx = await this.connection.removeChallenge(
      [encode(stateUpdate.toStruct())],
      [encode(challengeStateUpdate.toStruct())],
      witness.map(b => b.toHexString()),
      { gasLimit: this.gasLimit }
    )
    await tx.wait()
  }

  public async settle(stateUpdate: StateUpdate): Promise<void> {
    const tx = await this.connection.settle([encode(stateUpdate.toStruct())], {
      gasLimit: this.gasLimit
    })
    await tx.wait()
  }

  public async getClaimDecision(stateUpdate: StateUpdate): Promise<number> {
    const decision = await this.connection.getClaimDecision(
      stateUpdateToLog(stateUpdate)
    )
    return decision.value.toNumber()
  }

  public async isCompletable(stateUpdate: StateUpdate): Promise<boolean> {
    const isCompletable = await this.connection.isCompletable(
      stateUpdateToLog(stateUpdate)
    )
    return isCompletable
  }

  public subscribeExitClaimed(
    handler: (stateUpdate: StateUpdate) => void
  ): void {
    this.eventWatcher.subscribe('ExitClaimed', (log: EventLog) => {
      handler(logToStateUpdate(log.values[0]))
    })
  }

  public subscribeExitChallenged(
    handler: (
      challengeType: EXIT_CHALLENGE_TYPE,
      stateUpdate: StateUpdate,
      challengeStateUpdate?: StateUpdate
    ) => void
  ): void {
    this.eventWatcher.subscribe('ExitSpentChallenged', (log: EventLog) => {
      handler(EXIT_CHALLENGE_TYPE.SPENT, logToStateUpdate(log.values[0]))
    })
    this.eventWatcher.subscribe('ExitCheckpointChallenged', (log: EventLog) => {
      handler(
        EXIT_CHALLENGE_TYPE.CHECKPOINT,
        logToStateUpdate(log.values[0]),
        logToStateUpdate(log.values[1])
      )
    })
  }

  public subscribeExitChallengeRemoved(
    handler: (
      stateUpdate: StateUpdate,
      challengeStateUpdate: StateUpdate
    ) => void
  ): void {
    this.eventWatcher.subscribe('ExitChallengeRemoved', (log: EventLog) => {
      handler(logToStateUpdate(log.values[0]), logToStateUpdate(log.values[1]))
    })
  }

  public subscribeExitSettled(
    handler: (stateUpdate: StateUpdate, decision: boolean) => void
  ): void {
    this.eventWatcher.subscribe('ExitSettled', (log: EventLog) => {
      console.log('ExitSettled')
      handler(logToStateUpdate(log.values[0]), log.values[1])
    })
  }

  async startWatchingEvents() {
    this.unsubscribeAll()
    await this.eventWatcher.start(() => {
      // do nothing
    })
  }

  unsubscribeAll() {
    this.eventWatcher.cancel()
  }
}
