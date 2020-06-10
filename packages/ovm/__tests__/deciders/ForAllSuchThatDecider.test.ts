import { Bytes, BigNumber, Address } from '@cryptoeconomicslab/primitives'
import Coder from '@cryptoeconomicslab/coder'
import {
  initializeDeciderManager,
  NotDeciderAddress,
  ForAllSuchThatDeciderAddress,
  SampleDeciderAddress,
  LessThanDeciderAddress,
  AndDeciderAddress,
  IsLessThanDeciderAddress
} from '../helpers/initiateDeciderManager'
import {
  Property,
  FreeVariable,
  CompiledPredicate,
  CompiledDecider,
  PredicateLabel
} from '../../src'
import { setupContext } from '@cryptoeconomicslab/context'
setupContext({ coder: Coder })

describe('ForAllsuchThatDecider', () => {
  const zero = Coder.encode(BigNumber.from(0)).toHexString()
  const trueProperty = Coder.encode(
    new Property(SampleDeciderAddress, [Bytes.fromString('true')]).toStruct()
  )
  const falseProperty = Coder.encode(
    new Property(SampleDeciderAddress, []).toStruct()
  )
  const upperBound = Coder.encode(BigNumber.from(5))
  const placeholderedProperty = Coder.encode(
    new Property(LessThanDeciderAddress, [
      upperBound,
      FreeVariable.from('n')
    ]).toStruct()
  )
  const deciderManager = initializeDeciderManager()

  it('decide for all n such that n < 10: true', async () => {
    const upperBound = BigNumber.from(10)
    const hint = Bytes.fromString(
      `range,NUMBER,${zero}-${Coder.encode(upperBound).toHexString()}`
    )
    const property = new Property(ForAllSuchThatDeciderAddress, [
      hint,
      Bytes.fromString('n'),
      trueProperty
    ])
    const decision = await deciderManager.decide(property)
    expect(decision).toStrictEqual({
      outcome: true,
      challenge: null
    })
  })

  it('decide for all n such that n < 10: false', async () => {
    const upperBound = BigNumber.from(10)
    const hint = Bytes.fromString(
      `range,NUMBER,${zero}-${Coder.encode(upperBound).toHexString()}`
    )
    const property = new Property(ForAllSuchThatDeciderAddress, [
      hint,
      Bytes.fromString('n'),
      falseProperty
    ])
    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeFalsy()
    expect(decision.challenge).toStrictEqual({
      property: new Property(NotDeciderAddress, [falseProperty]),
      challengeInputs: [Coder.encode(BigNumber.from(0))]
    })
    expect(decision.traceInfo?.toString()).toEqual(
      'ForAllSuchThat:0x223022,BoolDecider:[]'
    )
  })

  it('decide for all n such that n < 2: n < 5', async () => {
    const upperBound = BigNumber.from(2)
    const hint = Bytes.fromString(
      `range,NUMBER,${zero}-${Coder.encode(upperBound).toHexString()}`
    )
    const property = new Property(ForAllSuchThatDeciderAddress, [
      hint,
      Bytes.fromString('n'),
      placeholderedProperty
    ])
    const decision = await deciderManager.decide(property)
    expect(decision).toStrictEqual({
      outcome: true,
      challenge: null
    })
  })

  it('decide for all n such that n < 10: n < 5', async () => {
    const upperBound = BigNumber.from(10)
    const hint = Bytes.fromString(
      `range,NUMBER,${zero}-${Coder.encode(upperBound).toHexString()}`
    )
    const property = new Property(ForAllSuchThatDeciderAddress, [
      hint,
      Bytes.fromString('n'),
      placeholderedProperty
    ])
    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeFalsy()
    expect(decision.challenge).toStrictEqual({
      property: new Property(NotDeciderAddress, [placeholderedProperty]),
      // challengeInput is 5 because 5 < 5 is false
      challengeInputs: [Coder.encode(BigNumber.from(5))]
    })
    expect(decision.traceInfo?.toString()).toEqual(
      'ForAllSuchThat:0x223522,LessThanDecider:[0x223522,0x223522]'
    )
  })

  it('fail to decide because of invalid hint data', async () => {
    const hint = Bytes.fromString('invalid hint string')
    const property = new Property(ForAllSuchThatDeciderAddress, [
      hint,
      Bytes.fromString('n'),
      placeholderedProperty
    ])
    await expect(deciderManager.decide(property)).rejects.toEqual(
      new Error('inputs[0] must be valid hint data.')
    )
  })

  describe('the valid challenge of Q.all(CompiledPredicate) is challenge(CompiledPredicate)', () => {
    const TestPredicateAddress = Address.from(
      '0x0250035000301010002000900380005700060001'
    )

    beforeAll(() => {
      const source = `@library
      @quantifier("range,NUMBER,\${zero}-\${upper_bound}")
      def Q(n, upper_bound) :=
        IsLessThan(n, upper_bound)
          
      def test(a) := Q(a).all(b -> Bool())
      `

      // Sets instance of CompiledDecider TestF
      const compiledPredicate = CompiledPredicate.fromSource(
        TestPredicateAddress,
        source,
        { zero: Coder.encode(BigNumber.from(0)).toHexString() }
      )
      const compiledDecider = new CompiledDecider(compiledPredicate)
      deciderManager.setDecider(TestPredicateAddress, compiledDecider)
    })

    it('valid challenge of Q.all(v -> !IsLessThan(v, 10) or Bool(false)) is "IsLessThan(v, 10) and !Bool(false)"', async () => {
      // An instance of compiled predicate "TestF(10)" is "Q().all(b -> !IsLessThan(b, 10) or Bool(false))".
      const property = new Property(TestPredicateAddress, [
        PredicateLabel.from('TestF'),
        Coder.encode(BigNumber.from(10))
      ])

      const decision = await deciderManager.decide(property)
      expect(decision.outcome).toEqual(false)
      expect(decision.challenge).toEqual({
        property: new Property(AndDeciderAddress, [
          Coder.encode(
            new Property(IsLessThanDeciderAddress, [
              Coder.encode(BigNumber.from(0)),
              Coder.encode(BigNumber.from(10))
            ]).toStruct()
          ),
          Coder.encode(
            new Property(NotDeciderAddress, [falseProperty]).toStruct()
          )
        ]),
        challengeInputs: [Coder.encode(BigNumber.from(0))]
      })
    })
  })
})
