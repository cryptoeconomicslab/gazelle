import { Property } from '../../../src/ovm/types'
import { Address, Bytes, Integer } from '../../../src/types/Codables'
import { initializeDeciderManager } from '../helpers/initiateDeciderManager'
import { CompiledDecider, CompiledPredicate } from '../../../src/ovm/decompiler'
import Coder from '../../../src/coder'
import { testSource } from './TestSource'

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
})
