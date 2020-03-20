import {
  Property,
  LogicalConnective,
  AtomicPredicate,
  AndDecider
} from '../../src'
import { Bytes, Integer, List } from '@cryptoeconomicslab/primitives'
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
      challenges: []
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
    expect(decision.challenges).toEqual([
      {
        challengeInput: challengeInput1,
        property: new Property(NotDeciderAddress, [falseProperty])
      }
    ])
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
    expect(decision.challenges).toEqual([
      {
        challengeInput: challengeInput0,
        property: new Property(NotDeciderAddress, [falseProperty])
      }
    ])
    expect(decision.traceInfo?.toString()).toEqual('And:0,Bool:[]')
  })
})
