import * as ethers from 'ethers'
import { IOwnershipPayoutContract } from '@cryptoeconomicslab/contract'
import { Address, BigNumber, Property } from '@cryptoeconomicslab/primitives'

export class OwnershipPayoutContract implements IOwnershipPayoutContract {
  public static abi = [
    'function finalizeExit(address depositContractAddress,tuple(address, bytes[]) _exitProperty, uint256 _depositedRangeId, address _owner)'
  ]

  private connection: ethers.Contract
  private gasLimit = 1000000

  constructor(readonly address: Address, signer: ethers.Signer) {
    this.connection = new ethers.Contract(
      address.data,
      OwnershipPayoutContract.abi,
      signer
    )
  }

  public async finalizeExit(
    depositContractAddress: Address,
    exitProperty: Property,
    depositedRangeId: BigNumber,
    owner: Address
  ): Promise<void> {
    await this.connection.finalizeExit(
      depositContractAddress.data,
      [exitProperty.deciderAddress.data, exitProperty.inputs],
      depositedRangeId.raw,
      owner.data,
      {
        gasLimit: this.gasLimit
      }
    )
  }
}
