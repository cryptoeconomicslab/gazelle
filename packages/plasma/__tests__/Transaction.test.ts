import {
  Address,
  BigNumber,
  Range,
  Property
} from '@cryptoeconomicslab/primitives'
import { Transaction } from '../src'
import Coder from '@cryptoeconomicslab/coder'
import { setupContext } from '@cryptoeconomicslab/context'
setupContext({ coder: Coder })

describe('transaction', () => {
  const transactionAddress = Address.default()
  const depositContractAddress = Address.default()
  const range = new Range(BigNumber.from(0), BigNumber.from(100))
  const maxBlockNumber = BigNumber.from(100)
  const ownershipPredicateAddress = Address.default()
  const owner = Address.default()

  test('create a transaction from property', () => {
    const stateObject = new Property(ownershipPredicateAddress, [
      ovmContext.coder.encode(owner)
    ])
    const expectedTx = new Transaction(
      depositContractAddress,
      range,
      maxBlockNumber,
      stateObject,
      Address.default()
    )
    const property = new Property(
      transactionAddress,
      [
        depositContractAddress,
        range.toStruct(),
        maxBlockNumber,
        stateObject.toStruct()
      ].map(i => ovmContext.coder.encode(i))
    )
    const transaction = Transaction.fromProperty(property)
    expect(transaction).toEqual(expectedTx)
  })
})
