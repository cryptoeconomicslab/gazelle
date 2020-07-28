import * as ethers from 'ethers'
import {
  BigNumber,
  Integer,
  Address,
  Bytes,
  Property,
  Range
} from '@cryptoeconomicslab/primitives'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import { IDepositContract, EventLog } from '@cryptoeconomicslab/contract'
import { StateUpdate } from '@cryptoeconomicslab/plasma'
import EthEventWatcher from '../events'
import ABI from '../abi'
import { stateUpdateToLog, logToStateUpdate, logToRange } from '../helper'

export class DepositContract implements IDepositContract {
  private eventWatcher: EthEventWatcher
  private connection: ethers.Contract
  readonly gasLimit: number

  public static abi = [
    `event CheckpointFinalized(bytes32 checkpointId, ${ABI.STATE_UPDATE} chekpoint)`,
    `event ExitFinalized(bytes32 exitId, ${ABI.STATE_UPDATE} exit)`,
    `event DepositedRangeExtended(${ABI.RANGE} newRange)`,
    `event DepositedRangeRemoved(${ABI.RANGE} removedRange)`,
    `function deposit(uint256 _amount, ${ABI.PROPERTY} _initialState)`,
    `function finalizeCheckpoint(${ABI.STATE_UPDATE} _checkpoint)`,
    `function finalizeExit(${ABI.STATE_UPDATE} _exit, uint256 _depositedRangeId)`
  ]
  constructor(
    readonly address: Address,
    eventDb: KeyValueStore,
    signer: ethers.Signer
  ) {
    this.connection = new ethers.Contract(
      address.data,
      DepositContract.abi,
      signer
    )
    this.gasLimit = 200000
    this.eventWatcher = new EthEventWatcher({
      provider: this.connection.provider,
      kvs: eventDb,
      contractAddress: address.data,
      contractInterface: this.connection.interface
    })
  }

  /**
   * Deposits amount of ETH with initial state
   * @param amount Amount of ETH. The unit is wei.
   * @param initialState Initial state of the range
   */
  async deposit(amount: BigNumber, initialState: Property): Promise<void> {
    return await this.connection.deposit(
      amount.raw,
      [initialState.deciderAddress.data, initialState.inputs],
      {
        gasLimit: this.gasLimit
      }
    )
  }
  async finalizeCheckpoint(checkpoint: StateUpdate): Promise<void> {
    return await this.connection.finalizeCheckpoint(
      stateUpdateToLog(checkpoint),
      {
        gasLimit: this.gasLimit
      }
    )
  }
  async finalizeExit(
    exit: StateUpdate,
    depositedRangeId: Integer
  ): Promise<void> {
    return await this.connection.finalizeExit(
      stateUpdateToLog(exit),
      depositedRangeId.data,
      {
        gasLimit: this.gasLimit
      }
    )
  }

  subscribeCheckpointFinalized(
    handler: (checkpointId: Bytes, checkpoint: StateUpdate) => Promise<void>
  ) {
    this.eventWatcher.subscribe('CheckpointFinalized', (log: EventLog) => {
      const checkpointId = Bytes.fromHexString(log.values[0])
      const checkpoint = logToStateUpdate(log.values[1])

      handler(checkpointId, checkpoint)
    })
  }

  subscribeExitFinalized(
    handler: (exitId: Bytes, exit: StateUpdate) => Promise<void>
  ) {
    this.eventWatcher.subscribe('ExitFinalized', (log: EventLog) => {
      const exitId = Bytes.fromHexString(log.values[0])
      const exit = logToStateUpdate(log.values[1])
      handler(exitId, exit)
    })
  }

  subscribeDepositedRangeExtended(handler: (range: Range) => Promise<void>) {
    this.eventWatcher.subscribe('DepositedRangeExtended', (log: EventLog) => {
      const range = logToRange(log.values.newRange)
      handler(range)
    })
  }

  subscribeDepositedRangeRemoved(handler: (range: Range) => Promise<void>) {
    this.eventWatcher.subscribe(
      'DepositedRangeRemoved',
      async (log: EventLog) => {
        const rawRange = log.values.removedRange
        const start = BigNumber.fromHexString(rawRange[0].toHexString())
        const end = BigNumber.fromHexString(rawRange[1].toHexString())
        await handler(new Range(start, end))
      }
    )
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
