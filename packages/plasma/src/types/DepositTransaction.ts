import { Address } from '@cryptoeconomicslab/primitives'
import StateUpdate from './StateUpdate'

export default class DepositTransaction {
  constructor(
    readonly depositContractAddress: Address,
    readonly stateUpdate: StateUpdate
  ) {}

  public toString(): string {
    return `DepostiTransaction {
      contractAddress: ${this.depositContractAddress.data},
      stateUpdate: ${this.stateUpdate.toStruct().toString()}
    }`
  }
}
