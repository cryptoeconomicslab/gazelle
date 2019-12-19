import Coder from '../../../src/coder'
import { Bytes, Integer } from '../../../src/types/Codables'
import {
  initializeDeciderManager,
  ThereExistsSuchThatDeciderAddress,
  LessThanDeciderAddress,
  GreaterThanDeciderAddress,
  LessThanQuantifierAddress,
  IsValidSignatureDeciderAddress
} from '../helpers/initiateDeciderManager'
import { Property, FreeVariable } from '../../../src/ovm/types'
import { DeciderManager } from '../../../src/ovm/DeciderManager'
import { secp256k1Verifier } from '../../../src/verifiers'

describe('ThereExistsSuchThatDecider', () => {
  const upperBound = Coder.encode(Integer.from(2))
  const lowerBound = Coder.encode(Integer.from(10))
  const lessThanTwoProperty = Coder.encode(
    new Property(LessThanDeciderAddress, [
      upperBound,
      FreeVariable.from('n')
    ]).toStruct()
  )
  const greaterThanTenProperty = Coder.encode(
    new Property(GreaterThanDeciderAddress, [
      lowerBound,
      FreeVariable.from('n')
    ]).toStruct()
  )

  let deciderManager: DeciderManager
  beforeEach(async () => {
    deciderManager = initializeDeciderManager()
  })

  test('ThereExists positive integer n of number less than 10 such that n is less than 2.', async () => {
    const upperBound = Coder.encode(Integer.from(10))
    const quantifier = Coder.encode(
      new Property(LessThanQuantifierAddress, [upperBound]).toStruct()
    )
    const property = new Property(ThereExistsSuchThatDeciderAddress, [
      quantifier,
      Bytes.fromString('n'),
      lessThanTwoProperty
    ])

    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeTruthy()
  })

  test('ThereDoesNotExists positive integer n of number less than 5 such that n is greater than 10.', async () => {
    const upperBound = Coder.encode(Integer.from(5))
    const quantifier = Coder.encode(
      new Property(LessThanQuantifierAddress, [upperBound]).toStruct()
    )
    const property = new Property(ThereExistsSuchThatDeciderAddress, [
      quantifier,
      Bytes.fromString('n'),
      greaterThanTenProperty
    ])

    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeFalsy()
  })

  test('There exists signature in witness db', async () => {
    const sigBucket = await deciderManager.witnessDb.bucket(
      Bytes.fromString('sig')
    )
    const publicKey = Bytes.fromHexString(
      '0x5640A00fAE03fa40d527C27dc28E67dF140Fd995'
    )
    const message = Bytes.fromString('message')
    const signature = Bytes.fromHexString(
      '0x682f001aa66b904779bbcd846e52a62f4cf7d643b91826fdec04441ab604a6d66330609ad20a1a14fb52e3967bd2086c131e634ee4823b8a7ce3be8d91038daa1b'
    )

    await sigBucket.put(message, signature)
    const hint = `sig,KEY,${message.toHexString()}`
    const property = new Property(ThereExistsSuchThatDeciderAddress, [
      Bytes.fromString(hint),
      Bytes.fromString('sig'),
      Coder.encode(
        new Property(IsValidSignatureDeciderAddress, [
          message,
          FreeVariable.from('sig'),
          publicKey,
          Bytes.fromString('secp256k1')
        ]).toStruct()
      )
    ])

    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeTruthy()
  })
})
