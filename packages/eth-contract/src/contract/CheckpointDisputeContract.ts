import * as ethers from 'ethers'
import { Bytes, Address, Codable } from '@cryptoeconomicslab/primitives'
import { EventLog } from '@cryptoeconomicslab/contract'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import EthEventWatcher from '../events'
import { StateUpdate } from '@cryptoeconomicslab/plasma'
import { DoubleLayerInclusionProof } from '@cryptoeconomicslab/merkle-tree'
import { ICheckpointDisputeContract } from '@cryptoeconomicslab/contract'
import { logToStateUpdate, logToInclusionProof } from '../helper'

const ABI = {
  STATE_UPDATE:
    'tuple(address, tuple(uint256, uint256), uint256, tuple(address, bytes[]))',
  INCLUSION_PROOF:
    'tuple(tuple(address, uint256, tuple(bytes32, address)[]), tuple(uint256, uint256, tuple(bytes32, uint256)[]))'
}

function encode(v: Codable) {
  return ovmContext.coder.encode(v).toHexString()
}

export class CheckpointDisputeContract implements ICheckpointDisputeContract {
  private connection: ethers.Contract
  private eventWatcher: EthEventWatcher
  readonly gasLimit: number = 800000

  public static abi = [
    // Events
    `event CheckpointClaimed(${ABI.STATE_UPDATE} stateUpdate, ${ABI.INCLUSION_PROOF} inclusionProof)`,
    `event CheckpointChallenged(${ABI.STATE_UPDATE} stateUpdate, ${ABI.STATE_UPDATE} challengingStateUpdate, ${ABI.INCLUSION_PROOF} inclusionProof)`,
    `event ChallengeRemoved(${ABI.STATE_UPDATE} stateUpdate, ${ABI.STATE_UPDATE} challengingStateUpdate)`,
    `event CheckpointSettled(${ABI.STATE_UPDATE})`,

    // DisputeContract methods
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
      CheckpointDisputeContract.abi,
      signer
    )
    this.eventWatcher = new EthEventWatcher({
      provider: this.connection.provider,
      kvs: eventDb,
      contractAddress: address.data,
      contractInterface: this.connection.interface
    })
  }

  async claim(
    stateUpdate: StateUpdate,
    inclusionProof: DoubleLayerInclusionProof
  ) {
    await this.connection.claim(
      [encode(stateUpdate.toStruct())],
      [encode(inclusionProof.toStruct())]
    )
  }

  async challenge(
    stateUpdate: StateUpdate,
    challenge: StateUpdate,
    inclusionProof: DoubleLayerInclusionProof
  ) {
    await this.connection.challenge(
      [encode(stateUpdate.toStruct())],
      [encode(challenge.toStruct())],
      [encode(inclusionProof.toStruct())]
    )
  }

  async removeChallenge(
    stateUpdate: StateUpdate,
    challenge: StateUpdate,
    witness: Bytes[]
  ) {
    await this.connection.removeChallenge(
      [encode(stateUpdate.toStruct())],
      [encode(challenge.toStruct())],
      witness.map(b => b.toHexString())
    )
  }

  async settle(stateUpdate: StateUpdate) {
    await this.connection.settle([encode(stateUpdate.toStruct())])
  }

  subscribeCheckpointClaimed(
    handler: (
      stateUpdate: StateUpdate,
      inclusionProof: DoubleLayerInclusionProof
    ) => void
  ) {
    this.eventWatcher.subscribe('CheckpointClaimed', (log: EventLog) => {
      handler(
        logToStateUpdate(log.values[0]),
        logToInclusionProof(log.values[1])
      )
    })
  }

  subscribeCheckpointChallenged(
    handler: (
      stateUpdate: StateUpdate,
      challenge: StateUpdate,
      inclusionProof: DoubleLayerInclusionProof
    ) => void
  ) {
    this.eventWatcher.subscribe('CheckpointChallenged', (log: EventLog) => {
      handler(
        logToStateUpdate(log.values[0]),
        logToStateUpdate(log.values[1]),
        logToInclusionProof(log.values[2])
      )
    })
  }

  subscribeCheckpointChallengeRemoved(
    handler: (stateUpdate: StateUpdate, challenge: StateUpdate) => void
  ) {
    this.eventWatcher.subscribe('ChallengeRemoved', (log: EventLog) => {
      handler(logToStateUpdate(log.values[0]), logToStateUpdate(log.values[1]))
    })
  }

  subscribeCheckpointSettled(handler: (stateUpdate: StateUpdate) => void) {
    this.eventWatcher.subscribe('CheckpointSettled', (log: EventLog) => {
      handler(logToStateUpdate(log.values[0]))
    })
  }
}
