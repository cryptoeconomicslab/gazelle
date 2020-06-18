import { Transaction } from '@cryptoeconomicslab/plasma'

export interface TransactionListItem {
  hash: string
  from: string // address
}

export function transformTransactionListItemFrom(
  transaction: Transaction
): TransactionListItem {
  return {
    hash: transaction.getHash().toHexString(),
    from: transaction.from.toString()
  }
}
