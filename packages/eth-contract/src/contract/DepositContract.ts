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
import EthEventWatcher from '../events'

export class DepositContract implements IDepositContract {
  private eventWatcher: EthEventWatcher
  private connection: ethers.Contract
  readonly gasLimit: number

  public static abi = [
    'event CheckpointFinalized(bytes32 checkpointId, tuple(tuple(address, bytes[])) checkpoint)',
    'event ExitFinalized(bytes32 exitId)',
    'event DepositedRangeExtended(tuple(uint256, uint256) newRange)',
    'event DepositedRangeRemoved(tuple(uint256, uint256) removedRange)',
    'function deposit(uint256 _amount, tuple(address, bytes[]) _initialState)',
    'function finalizeCheckpoint(tuple(address, bytes[]) _checkpoint)',
    'function finalizeExit(tuple(address, bytes[]) _exit, uint256 _depositedRangeId)'
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
  async finalizeCheckpoint(checkpoint: Property): Promise<void> {
    return await this.connection.finalizeCheckpoint(
      [checkpoint.deciderAddress.data, checkpoint.inputs],
      {
        gasLimit: this.gasLimit
      }
    )
  }
  async finalizeExit(exit: Property, depositedRangeId: Integer): Promise<void> {
    return await this.connection.finalizeExit(
      [exit.deciderAddress.data, exit.inputs],
      depositedRangeId.data,
      {
        gasLimit: this.gasLimit
      }
    )
  }

  subscribeCheckpointFinalized(
    handler: (checkpointId: Bytes, checkpoint: [Property]) => Promise<void>
  ) {
    this.eventWatcher.subscribe(
      'CheckpointFinalized',
      async (log: EventLog) => {
        const checkpointId = log.values[0]
        const checkpoint = log.values[1]
        const stateUpdate = new Property(
          Address.from(checkpoint[0][0]),
          checkpoint[0][1].map(Bytes.fromHexString)
        )

        await handler(Bytes.fromHexString(checkpointId), [stateUpdate])
      }
    )
  }

  subscribeExitFinalized(handler: (exitId: Bytes) => Promise<void>) {
    this.eventWatcher.subscribe('ExitFinalized', async (log: EventLog) => {
      const [exitId] = log.values
      await handler(Bytes.fromHexString(exitId))
    })
  }

  subscribeDepositedRangeExtended(handler: (range: Range) => Promise<void>) {
    this.eventWatcher.subscribe(
      'DepositedRangeExtended',
      async (log: EventLog) => {
        const rawRange = log.values.newRange
        const start = BigNumber.fromHexString(rawRange[0].toHexString())
        const end = BigNumber.fromHexString(rawRange[1].toHexString())
        await handler(new Range(start, end))
      }
    )
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
