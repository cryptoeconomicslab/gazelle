import { Address, BigNumber } from '@cryptoeconomicslab/primitives'
import { StateUpdate } from '@cryptoeconomicslab/plasma'

/**
 * OwnershipPayoutContract interface
 */
export interface IOwnershipPayoutContract {
  finalizeExit(
    depositContractAddress: Address,
    exit: StateUpdate,
    depositedRangeId: BigNumber,
    owner: Address
  ): Promise<void>
}
