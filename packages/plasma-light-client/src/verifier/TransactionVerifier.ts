import { StateUpdate, Transaction } from '@cryptoeconomicslab/plasma'
import JSBI from 'jsbi'

/**
 * Verifies if given transaction can spend given stateUpdate
 */
export function verifyTransaction(
  stateUpdate: StateUpdate,
  transaction: Transaction
): boolean {
  return (
    JSBI.greaterThanOrEqual(
      transaction.maxBlockNumber.data,
      stateUpdate.blockNumber.data
    ) &&
    stateUpdate.depositContractAddress.equals(
      transaction.depositContractAddress
    ) &&
    transaction.range.contains(stateUpdate.range)
  )
}
