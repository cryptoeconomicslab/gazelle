import { AtomicPredicate, NotDecider } from '../../src'
import { Bytes, Property } from '@cryptoeconomicslab/primitives'
import Coder from '@cryptoeconomicslab/coder'
import { MockDeciderManager } from '../mocks/MockDeciderManager'
import { setupContext } from '@cryptoeconomicslab/context'
setupContext({ coder: Coder })

describe('NotDecider', () => {
  const deciderManager = new MockDeciderManager()
  const BoolDeciderAddress = deciderManager.getDeciderAddress(
    AtomicPredicate.Bool
  )
  const trueProperty = new Property(BoolDeciderAddress, [
    Bytes.fromString('true')
  ])
  const falseProperty = new Property(BoolDeciderAddress, [])
  it('decide not(false)', async () => {
    const nodeDecider = new NotDecider()
    const decision = await nodeDecider.decide(deciderManager, [
      Coder.encode(falseProperty.toStruct())
    ])
    expect(decision.outcome).toEqual(true)
  })
  it('decide not(true)', async () => {
    const nodeDecider = new NotDecider()
    const decision = await nodeDecider.decide(deciderManager, [
      Coder.encode(trueProperty.toStruct())
    ])
    expect(decision.outcome).toEqual(false)
    // valid challenge is SampleDecider(true)
    expect(decision.challenge).toEqual({
      challengeInputs: [],
      property: trueProperty
    })
  })
})
