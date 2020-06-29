import {
  LogicalConnective,
  AtomicPredicate,
  AndDecider,
  CompiledPredicate,
  CompiledDecider,
  DeciderManager,
  PredicateLabel
} from '../../src'
import {
  initializeDeciderManager,
  IsLessThanDeciderAddress
} from '../helpers/initiateDeciderManager'
import {
  Bytes,
  Integer,
  List,
  Address,
  BigNumber,
  Property
} from '@cryptoeconomicslab/primitives'
import DefaultCoder from '@cryptoeconomicslab/coder'
import { MockDeciderManager } from '../mocks/MockDeciderManager'
import Coder from '@cryptoeconomicslab/coder'
import { setupContext } from '@cryptoeconomicslab/context'
import JsonCoder from '@cryptoeconomicslab/coder'
setupContext({ coder: Coder })

describe('AndDecider', () => {
  const deciderManager = new MockDeciderManager()
  const NotDeciderAddress = deciderManager.getDeciderAddress(
    LogicalConnective.Not
  )
  const BoolDeciderAddress = deciderManager.getDeciderAddress(
    AtomicPredicate.Bool
  )
  const trueProperty = DefaultCoder.encode(
    new Property(BoolDeciderAddress, [Bytes.fromString('true')]).toStruct()
  )
  const falseProperty = DefaultCoder.encode(
    new Property(BoolDeciderAddress, []).toStruct()
  )
  const challengeInput0 = DefaultCoder.encode(Integer.from(0))
  const challengeInput1 = DefaultCoder.encode(Integer.from(1))

  it('decide and(true, true)', async () => {
    const andDecider = new AndDecider()
    const decision = await andDecider.decide(deciderManager, [
      trueProperty,
      trueProperty
    ])
    expect(decision).toEqual({
      outcome: true,
      witnesses: [
        JsonCoder.encode(List.from(Bytes, [])),
        JsonCoder.encode(List.from(Bytes, []))
      ],
      challenge: null
    })
  })
  it('decide and(true, false)', async () => {
    const andDecider = new AndDecider()
    const decision = await andDecider.decide(deciderManager, [
      trueProperty,
      falseProperty
    ])
    expect(decision.outcome).toEqual(false)
    // valid challenge is Not(SampleDecider(false))
    expect(decision.challenge).toEqual({
      challengeInputs: [challengeInput1],
      property: new Property(NotDeciderAddress, [falseProperty])
    })
    expect(decision.traceInfo?.toString()).toEqual('And:1,Bool:[]')
  })
  it('decide and(false, true)', async () => {
    const andDecider = new AndDecider()
    const decision = await andDecider.decide(deciderManager, [
      falseProperty,
      trueProperty
    ])
    expect(decision.outcome).toEqual(false)
    // valid challenge is Not(SampleDecider(false))
    expect(decision.challenge).toEqual({
      challengeInputs: [challengeInput0],
      property: new Property(NotDeciderAddress, [falseProperty])
    })
    expect(decision.traceInfo?.toString()).toEqual('And:0,Bool:[]')
  })

  describe('the valid challenge of !A and B is A', () => {
    const TestPredicateAddress = Address.from(
      '0x0250035000301010002000900380005700060001'
    )
    let deciderManager: DeciderManager
    beforeAll(() => {
      deciderManager = initializeDeciderManager()

      const source = `
      def test(a, b, c) := !IsLessThan(a, c) and IsLessThan(b, c)
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

    it('valid challenge of "!IsLessThan(1, 10) and IsLessThan(2, 10)" is "IsLessThan(1, 10)"', async () => {
      const property = new Property(TestPredicateAddress, [
        PredicateLabel.from('TestA'),
        Coder.encode(BigNumber.from(1)),
        Coder.encode(BigNumber.from(2)),
        Coder.encode(BigNumber.from(10))
      ])

      const decision = await deciderManager.decide(property)
      expect(decision.outcome).toEqual(false)
      expect(decision.challenge).toEqual({
        property: new Property(IsLessThanDeciderAddress, [
          Coder.encode(BigNumber.from(1)),
          Coder.encode(BigNumber.from(10))
        ]),
        challengeInputs: [Coder.encode(Integer.from(0))]
      })
    })
  })
})
