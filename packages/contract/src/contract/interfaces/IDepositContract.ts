import {
  Integer,
  BigNumber,
  Bytes,
  Address,
  Range
} from '@cryptoeconomicslab/primitives'
import { Property } from '@cryptoeconomicslab/ovm'

export interface IDepositContract {
  address: Address
  /**
   * Deposits token with initial state
   * @param amount Amount of token. e.g. The unit is wei in ethereum.
   * @param initialState Initial state of the range
   */
  deposit(amount: BigNumber, initialState: Property): Promise<void>
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
    handler: (checkpointId: Bytes, checkpoint: [Property]) => void
  ): void

  /**
   * subscribe to exit finalized event
   */
  subscribeExitFinalized(handler: (exitId: Bytes) => void): void

  subscribeDepositedRangeExtended(handler: (range: Range) => void): void

  subscribeDepositedRangeRemoved(handler: (range: Range) => void): void
}
