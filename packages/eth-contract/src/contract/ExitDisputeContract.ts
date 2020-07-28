import * as ethers from 'ethers'
import { Bytes, Address, Codable } from '@cryptoeconomicslab/primitives'
import { EventLog } from '@cryptoeconomicslab/contract'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import EthEventWatcher from '../events'
import { StateUpdate } from '@cryptoeconomicslab/plasma'
import { DoubleLayerInclusionProof } from '@cryptoeconomicslab/merkle-tree'
import { IExitDisputeContract } from '@cryptoeconomicslab/contract'
import { ExitChallenge, EXIT_CHALLENGE_TYPE } from '@cryptoeconomicslab/plasma'
import { logToStateUpdate, logToInclusionProof } from '../helper'

function encode(v: Codable) {
  return ovmContext.coder.encode(v).toHexString()
}

function createChallengeInputAndWitness(challenge: ExitChallenge): Bytes[][] {
  if (challenge.type === EXIT_CHALLENGE_TYPE.SPENT) {
    return [
      [
        Bytes.fromString(challenge.type).toHexString(),
        encode(challenge.transaction.body)
      ],
      challenge.witness
    ]
  } else if (challenge.type === EXIT_CHALLENGE_TYPE.CHECKPOINT) {
    return [
      [
        Bytes.fromString(challenge.type).toHexString(),
        encode(challenge.stateUpdate.toStruct())
      ],
      [encode(challenge.inclusionProof.toStruct())]
    ]
  } else {
    throw new Error('Invalid Exit challenge type')
  }
}

const ABI = {
  STATE_UPDATE:
    'tuple(address, tuple(uint256, uint256), uint256, tuple(address, bytes[]))',
  INCLUSION_PROOF:
    'tuple(tuple(address, uint256, tuple(bytes32, address)[]), tuple(uint256, uint256, tuple(bytes32, uint256)[]))'
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
    `event ExitChallenged(${ABI.STATE_UPDATE} stateUpdate, bytes challengeType)`,
    // TODO: implmemnt in contract
    `event ChallengeRemoved(${ABI.STATE_UPDATE} stateUpdate, ${ABI.STATE_UPDATE} challengingStateUpdate)`,
    `event ExitSettled(${ABI.STATE_UPDATE})`,

    // methods
    'function claim(bytes[] inputs, bytes[] witness)',
    'function challenge(bytes[] inputs, bytes[] challengeInputs, bytes[] witness)',
    'function removeChallenge(bytes[] inputs, bytes[] challengeInputs, bytes[] witness)',
    'function settle(bytes[] inputs)'
  ]

  constructor(
    readonly address: Address,
    eventDb: KeyValueStore,
    signer: ethers.Signer
  ) {
    this.connection = new ethers.Contract(
      address.data,
      ExitDisputeContract.abi,
      signer
    )
    this.eventWatcher = new EthEventWatcher({
      provider: this.connection.provider,
      kvs: eventDb,
      contractAddress: address.data,
      contractInterface: this.connection.interface
    })
  }

  public async claim(
    stateUpdate: StateUpdate,
    inclusionProof: DoubleLayerInclusionProof
  ): Promise<void> {
    await this.connection.claim(
      [encode(stateUpdate.toStruct())],
      [encode(inclusionProof.toStruct())]
    )
  }

  public async challenge(challenge: ExitChallenge): Promise<void> {
    // tODO: conditional call for challenge type
    await this.connection.challenge(
      [encode(challenge.stateUpdate.toStruct())],
      ...createChallengeInputAndWitness(challenge)
    )
  }

  public async removeChallenge(
    challenge: ExitChallenge,
    witness: Bytes[]
  ): Promise<void> {
    if (challenge.type === EXIT_CHALLENGE_TYPE.CHECKPOINT) {
      await this.connection.removeChallenge(
        [encode(challenge.stateUpdate.toStruct())],
        [encode(challenge.challengeStateUpdate.toStruct())],
        witness.map(b => b.toHexString())
      )
    }
  }

  public async settle(stateUpdate: StateUpdate): Promise<void> {
    await this.connection.settle([encode(stateUpdate.toStruct())])
  }

  public subscribeExitClaimed(
    handler: (
      stateUpdate: StateUpdate,
      inclusionProof: DoubleLayerInclusionProof
    ) => void
  ): void {
    this.eventWatcher.subscribe('ExitClaimed', (log: EventLog) => {
      handler(
        logToStateUpdate(log.values[0]),
        logToInclusionProof(log.values[1])
      )
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
    handler: (stateUpdate: StateUpdate) => void
  ): void {
    this.eventWatcher.subscribe('ExitSettled', (log: EventLog) => {
      handler(logToStateUpdate(log.values[0]))
    })
  }
}
