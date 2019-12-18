import { Property } from '../../../src/ovm/types'
import { Address, Bytes, Integer, BigNumber } from '../../../src/types/Codables'
import { initializeDeciderManager } from '../helpers/initiateDeciderManager'
import { CompiledDecider, CompiledPredicate } from '../../../src/ovm/decompiler'
import Coder from '../../../src/coder'
import { testSource } from './TestSource'
import * as ethers from 'ethers'
import { Range } from '../../../src/types'
import { RangeDb } from '../../../src/db'
import { SigningKey, arrayify, joinSignature, keccak256 } from 'ethers/utils'

function sign(message: Bytes, privateKey: string): Bytes {
  const signingKey = new SigningKey(arrayify(privateKey))
  return Bytes.fromHexString(
    joinSignature(
      signingKey.signDigest(arrayify(keccak256(arrayify(message.data))))
    )
  )
}

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
      new CompiledPredicate(testSource),
      {}
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
    const ownerAddress = '0x5640A00fAE03fa40d527C27dc28E67dF140Fd995'
    const privateKey =
      '0x27c1fd11b5802634df90c30a2ae8eb6c22c3b5523115a2d8aa6de81fc01024f7'
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
      secp256k1: Bytes.fromString('secp256k1'),
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
      ownershipPredicate,
      constantVariableTable
    )
    const stateUpdateDecider = new CompiledDecider(
      StateUpdatePredicateAddress,
      stateUpdatePredicate,
      constantVariableTable
    )
    deciderManager.setDecider(OwnershipPredicateAddress, ownershipDecider)
    deciderManager.setDecider(StateUpdatePredicateAddress, stateUpdateDecider)

    // Create an instance of compiled predicate "Ownership(owner, tx)".
    const ownershipProperty = new Property(OwnershipPredicateAddress, [
      Bytes.fromHexString(ownerAddress)
    ])

    const transaction = Coder.encode(
      new Property(TransactionPredicateAddress, [
        token,
        range,
        blockNumber,
        Coder.encode(ownershipProperty.toStruct())
      ]).toStruct()
    )

    const stateUpdateProperty = new Property(StateUpdatePredicateAddress, [
      Bytes.fromString('StateUpdateT'),
      Bytes.fromHexString(ethers.constants.AddressZero),
      range,
      Coder.encode(BigNumber.from(572)),
      Coder.encode(ownershipProperty.toStruct())
    ])

    const rangeDb = new RangeDb(deciderManager.witnessDb)
    const txBucket = await rangeDb.bucket(Bytes.fromString('tx'))
    const blockBucket = await txBucket.bucket(
      Bytes.fromString('block0x2235373222')
    )
    const rangeBucket = await blockBucket.bucket(
      Bytes.fromString('range0x0000000000000000000000000000000000000000')
    )
    await rangeBucket.put(0n, 100n, transaction)
    const signature = sign(transaction, privateKey)
    await (await deciderManager.witnessDb.bucket(
      Bytes.fromString('signatures')
    )).put(transaction, signature)

    const decision = await stateUpdateDecider.decide(
      deciderManager,
      stateUpdateProperty.inputs,
      {}
    )
    expect(decision).toEqual({
      outcome: true,
      challenges: []
    })
  })
})
