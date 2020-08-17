import {
  Bytes,
  Address,
  Range,
  BigNumber,
  Property
} from '@cryptoeconomicslab/primitives'
import { UnsignedTransaction } from '@cryptoeconomicslab/plasma'
import EthCoder from '@cryptoeconomicslab/eth-coder'
import { setupContext } from '@cryptoeconomicslab/context'
import config from './data/test.config'
import { createTypedParams } from '../src'
setupContext({ coder: EthCoder })

describe('TypedDataVerifier', () => {
  const depositContractAddress = Address.from(
    '0x4e71920b7330515faf5ea0c690f1ad06a85fb60c'
  )
  const range = new Range(
    BigNumber.fromString('0'),
    BigNumber.fromString('100000000000000000')
  )
  const toAddress = Address.from('0xf17f52151ebef6c7334fad080c5704d77216b732')
  const predicateAddress = Address.from(
    '0x13274fe19c0178208bcbee397af8167a7be27f6f'
  )
  const invalidPredicateAddress = Address.from(
    '0x13274fe19c0178208bcbee397af8167a7be27f0a'
  )

  function createTransaction(stateObject: Property): Bytes {
    const tx = new UnsignedTransaction(
      depositContractAddress,
      range,
      BigNumber.from(0),
      stateObject,
      Bytes.default(),
      Address.default()
    )
    return tx.message
  }

  test('createTypedParams returns typed params', async () => {
    const tx = createTransaction(
      new Property(predicateAddress, [ovmContext.coder.encode(toAddress)])
    )
    expect(createTypedParams(config, tx)).toEqual([
      {
        name: 'token',
        type: 'address',
        value: depositContractAddress.data
      },
      { name: 'amount', type: 'uint256', value: '100000000000000000' },
      {
        name: 'owner',
        type: 'address',
        value: toAddress.data
      },
      {
        name: 'transaction',
        type: 'bytes',
        value: tx.toHexString()
      }
    ])
  })

  test('createTypedParams throw error because nputs are not satisfied', async () => {
    const tx = createTransaction(new Property(predicateAddress, []))
    expect(() => {
      createTypedParams(config, tx)
    }).toThrowError('incorrect inputs size')
  })

  test('createTypedParams throw error because of invalid predicate address', async () => {
    const tx = createTransaction(
      new Property(invalidPredicateAddress, [
        ovmContext.coder.encode(toAddress)
      ])
    )
    expect(() => {
      createTypedParams(config, tx)
    }).toThrowError(
      `createTypedParams failed because compiledPredicate of ${invalidPredicateAddress} was not found.`
    )
  })
})
