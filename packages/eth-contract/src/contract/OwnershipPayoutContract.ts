import * as ethers from 'ethers'
import { IOwnershipPayoutContract } from '@cryptoeconomicslab/contract'
import { Address, BigNumber } from '@cryptoeconomicslab/primitives'
import { StateUpdate } from '@cryptoeconomicslab/plasma'
import { stateUpdateToLog } from '../helper'
import ABI from '../abi'

export class OwnershipPayoutContract implements IOwnershipPayoutContract {
  public static abi = [
    `function finalizeExit(address depositContractAddress, ${ABI.STATE_UPDATE} _exit, uint256 _depositedRangeId, address _owner)`
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
    exit: StateUpdate,
    depositedRangeId: BigNumber,
    owner: Address
  ): Promise<void> {
    const tx = await this.connection.finalizeExit(
      depositContractAddress.data,
      stateUpdateToLog(exit),
      depositedRangeId.raw,
      owner.data,
      {
        gasLimit: this.gasLimit
      }
    )
    await tx.wait()
  }
}
