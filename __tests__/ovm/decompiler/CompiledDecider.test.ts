import { Property, FreeVariable } from '../../../src/ovm/types'
import { Address, Bytes, Integer, BigNumber } from '../../../src/types/Codables'
import {
  initializeDeciderManager,
  ThereExistsSuchThatDeciderAddress,
  AndDeciderAddress,
  EqualDeciderAddress,
  IsContainedDeciderAddress
} from '../helpers/initiateDeciderManager'
import { CompiledDecider, CompiledPredicate } from '../../../src/ovm/decompiler'
import Coder from '../../../src/coder'
import { testSource } from './TestSource'
import * as ethers from 'ethers'
import { Range } from '../../../src/types'

describe('CompiledDecider', () => {
  const TestPredicateAddress = Address.from(
    '0x0250035000301010002000900380005700060001'
  )

  const deciderManager = initializeDeciderManager()

  test('decide a property using compiled predicate', async () => {
    // An instance of compiled predicate "TestF(TestF, 10)".
    const property = new Property(TestPredicateAddress, [
      Bytes.fromString('TestF'),
      Coder.encode(Integer.from(10))
    ])

    // Sets instance of CompiledDecider TestF
    const compiledDecider = new CompiledDecider(
      TestPredicateAddress,
      new CompiledPredicate(testSource)
    )
    deciderManager.setDecider(TestPredicateAddress, compiledDecider)

    // TestF calls TestFA during deciding
    const decision = await compiledDecider.decide(
      deciderManager,
      property.inputs,
      {}
    )

    expect(decision).toEqual({
      challenges: [],
      outcome: true
    })
  })

  test('su', async () => {
    const OwnershipPredicateAddress = Address.from(
      '0x0250035000301010002000900380007500060002'
    )
    const StateUpdatePredicateAddress = Address.from(
      '0x0250035000301010036200900380007500060003'
    )
    const TransactionPredicateAddress = Address.from(
      '0x0250035000301010036208200380007500060005'
    )
    const constantVariableTable = {
      TransactionAddress: Bytes.fromHexString(TransactionPredicateAddress.data)
    }
    const token = Bytes.fromHexString(ethers.constants.AddressZero)
    const range = Coder.encode(
      new Range(BigNumber.from(0), BigNumber.from(100)).toStruct()
    )
    const blockNumber = Coder.encode(BigNumber.from(572))

    const ownershipPredicate = CompiledPredicate.fromSource(
      'def ownership(owner, tx) := SignedBy(tx, owner)'
    )
    const stateUpdatePredicate = CompiledPredicate.fromSource(
      `def stateUpdate(token, range, block_number, so) :=
      with Tx(token, range, block_number) as tx {
        so(tx)
      }`
    )
    const ownershipDecider = new CompiledDecider(
      OwnershipPredicateAddress,
      ownershipPredicate
    )
    const stateUpdateDecider = new CompiledDecider(
      StateUpdatePredicateAddress,
      stateUpdatePredicate
    )
    deciderManager.setDecider(OwnershipPredicateAddress, ownershipDecider)
    deciderManager.setDecider(StateUpdatePredicateAddress, stateUpdateDecider)

    // Create an instance of compiled predicate "Ownership(owner, tx)".
    const ownershipProperty = new Property(OwnershipPredicateAddress, [
      Bytes.fromHexString(ethers.constants.AddressZero)
    ])

    const transaction = Coder.encode(
      new Property(TransactionPredicateAddress, [
        token,
        range,
        blockNumber,
        Coder.encode(ownershipProperty.toStruct())
      ]).toStruct()
    )

    const resultOwnershipProperty = new Property(OwnershipPredicateAddress, [
      Bytes.fromString('OwnershipT'),
      transaction,
      Bytes.fromHexString(ethers.constants.AddressZero)
    ])

    const stateUpdateProperty = new Property(StateUpdatePredicateAddress, [
      Bytes.fromString('StateUpdateT'),
      Bytes.fromHexString(ethers.constants.AddressZero),
      range,
      Coder.encode(BigNumber.from(572)),
      Coder.encode(ownershipProperty.toStruct())
    ])
    const stateUpdateTAProperty = new Property(StateUpdatePredicateAddress, [
      Bytes.fromString('StateUpdateTA'),
      transaction,
      Bytes.fromHexString(ethers.constants.AddressZero),
      range,
      Coder.encode(BigNumber.from(572)),
      Coder.encode(ownershipProperty.toStruct())
    ])

    // Decompile StateUpdate
    const property = stateUpdatePredicate.instantiate(
      stateUpdateProperty,
      deciderManager.predicateAddressTable
    )
    const propertyTA = stateUpdatePredicate.instantiate(
      stateUpdateTAProperty,
      deciderManager.predicateAddressTable,
      constantVariableTable
    )

    expect(property).toEqual({
      deciderAddress: ThereExistsSuchThatDeciderAddress,
      inputs: [
        Bytes.fromString(
          'range:tx_block0x2235373222_range0x5b22313030222c2230225d:0x0000000000000000000000000000000000000000'
        ),
        Bytes.fromString('tx'),
        Coder.encode(
          new Property(StateUpdatePredicateAddress, [
            Bytes.fromString('StateUpdateTA'),
            FreeVariable.from('tx'),
            Bytes.fromHexString(ethers.constants.AddressZero),
            range,
            Coder.encode(BigNumber.from(572)),
            Coder.encode(ownershipProperty.toStruct())
          ]).toStruct()
        )
      ]
    })

    expect(propertyTA).toEqual({
      deciderAddress: AndDeciderAddress,
      inputs: [
        Coder.encode(
          new Property(EqualDeciderAddress, [
            Bytes.fromHexString(TransactionPredicateAddress.data),
            Bytes.fromHexString(TransactionPredicateAddress.data)
          ]).toStruct()
        ),
        Coder.encode(
          new Property(EqualDeciderAddress, [
            Bytes.fromHexString(ethers.constants.AddressZero),
            Bytes.fromHexString(ethers.constants.AddressZero)
          ]).toStruct()
        ),
        Coder.encode(
          new Property(IsContainedDeciderAddress, [range, range]).toStruct()
        ),
        Coder.encode(
          new Property(EqualDeciderAddress, [
            Coder.encode(BigNumber.from(572)),
            Coder.encode(BigNumber.from(572))
          ]).toStruct()
        ),
        Coder.encode(
          new Property(OwnershipPredicateAddress, [
            Bytes.fromHexString(ethers.constants.AddressZero),
            transaction
          ]).toStruct()
        )
      ]
    })

    /*
    const decision = await stateUpdateDecider.decide(
      deciderManager,
      stateUpdateProperty.inputs,
      {}
    )
    console.log(decision)
    */
  })
})
