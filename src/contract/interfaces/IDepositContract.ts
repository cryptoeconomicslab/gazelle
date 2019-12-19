import { Integer, Bytes, Address, Range } from '../../../src/types'
import { Property } from '../../ovm/types'

export interface IDepositContract {
  address: Address
  /**
   * Deposits amount of ETH with initial state
   * @param amount Amount of ETH. Unit is GWEI
   * @param initialState initial state of the range
   */
  deposit(amount: Integer, initialState: Property): Promise<void>
  /**
   * Finalizes checkpoint claim
   * @param checkpoint Checkpoint property which has been decided true by Adjudicator Contract.
   */
  finalizeCheckpoint(checkpoint: Property): Promise<void>
  /**
   * Finalizes exit claim and withdraw fund
   * @param exit The exit property which has been decided true by Adjudicator Contract.
   * @param depositedRangeId The id of range. We can know depositedRangeId from deposited event and finalizeExited event.
   */
  finalizeExit(exit: Property, depositedRangeId: Integer): Promise<void>

  /**
   * subscribe to checkpoint finalized event
   */
  subscribeCheckpointFinalized(
    handler: (checkpointId: Bytes, checkpoint: [Range, Property]) => void
  ): void

  /**
   * subscribe to exit finalized event
   */
  subscribeExitFinalized(handler: (exitId: Bytes) => void): void
}
