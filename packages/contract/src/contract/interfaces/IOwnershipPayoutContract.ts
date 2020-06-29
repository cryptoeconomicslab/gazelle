import { Address, BigNumber, Property } from '@cryptoeconomicslab/primitives'

/**
 * OwnershipPayoutContract interface
 */
export interface IOwnershipPayoutContract {
  finalizeExit(
    depositContractAddress: Address,
    exitProperty: Property,
    depositedRangeId: BigNumber,
    owner: Address
  ): Promise<void>
}
