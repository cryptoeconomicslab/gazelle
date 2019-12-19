import { Property, FreeVariable } from '../../../src/ovm/types'
import { Address, Bytes, Integer } from '../../../src/types/Codables'
import {
  initializeDeciderManager,
  ForAllSuchThatDeciderAddress,
  LessThanQuantifierAddress,
  ThereExistsSuchThatDeciderAddress,
  IsValidSignatureDeciderAddress
} from '../helpers/initiateDeciderManager'
import { CompiledPredicate } from '../../../src/ovm/decompiler/CompiledPredicate'
import Coder from '../../../src/coder'
import { testSource } from './TestSource'
import { ethers } from 'ethers'

describe('CompiledPredicate', () => {
  const TestPredicateAddress = Address.from(
    '0x0250035000301010002000900380005700060001'
  )

  const deciderManager = initializeDeciderManager()

  const constantValTable = {
    secp256k1: Bytes.fromString('secp256k1')
  }

  it('return Property', async () => {
    // Create predicate from "def Test(a) = for b in LessThan(a) {Bool(b) and Bool(b)}".
    const compiledPredicate = new CompiledPredicate(
      TestPredicateAddress,
      testSource
    )
    // Create an property of compiled predicate "TestF(TestF, 10)".
    const compiledProperty = new Property(TestPredicateAddress, [
      Bytes.fromString('TestF'),
      Coder.encode(Integer.from(10))
    ])
    // decompile property "TestF(TestF, 10)" to "for b in LessThan(a) {Bool(b) and Bool(b)}".
    const property = compiledPredicate.decompileProperty(
      compiledProperty,
      deciderManager.predicateAddressTable,
      constantValTable
    )

    expect(property).toEqual({
      deciderAddress: ForAllSuchThatDeciderAddress,
      inputs: [
        Coder.encode(
          new Property(LessThanQuantifierAddress, [
            Bytes.fromHexString('0x3130')
          ]).toStruct()
        ),
        Bytes.fromString('b'),
        Coder.encode(
          new Property(TestPredicateAddress, [
            Bytes.fromHexString('0x546573744641'),
            Bytes.fromHexString('0x5f5f5641524941424c455f5f62')
          ]).toStruct()
        )
      ]
    })
  })

  it('fromSource', async () => {
    // Create predicate from "def ownership(owner, tx) := SignedBy(tx, owner)".
    const compiledPredicate = CompiledPredicate.fromSource(
      TestPredicateAddress,
      'def ownership(owner, tx) := SignedBy(tx, owner)'
    )
    // Create an instance of compiled predicate "Ownership(owner, tx)".
    const ownershipProperty = new Property(TestPredicateAddress, [
      Bytes.fromString('OwnershipT'),
      Bytes.fromHexString(ethers.constants.AddressZero),
      Bytes.fromHexString('0x0012')
    ])
    // Decompile "Ownership(owner, tx)" to "SignedBy(tx, owner)".
    const property = compiledPredicate.decompileProperty(
      ownershipProperty,
      deciderManager.predicateAddressTable,
      constantValTable
    )

    expect(property).toEqual({
      deciderAddress: ThereExistsSuchThatDeciderAddress,
      inputs: [
        Bytes.fromString('signatures,KEY,0x0012'),
        Bytes.fromString('sig'),
        Coder.encode(
          new Property(IsValidSignatureDeciderAddress, [
            Bytes.fromHexString('0x0012'),
            FreeVariable.from('sig'),
            Bytes.fromHexString(ethers.constants.AddressZero),
            Bytes.fromString('secp256k1')
          ]).toStruct()
        )
      ]
    })
  })
})
