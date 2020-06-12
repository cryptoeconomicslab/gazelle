import { Address, Bytes, BigNumber } from '@cryptoeconomicslab/primitives'
import {
  initializeDeciderManager,
  ForAllSuchThatDeciderAddress,
  IsLessThanDeciderAddress
} from '../helpers/initiateDeciderManager'
import {
  CompiledDecider,
  CompiledPredicate,
  Property,
  LogicalConnective,
  FreeVariable,
  PredicateLabel
} from '../../src'
import Coder from '@cryptoeconomicslab/coder'
import { testSource } from './TestSource'
import { setupContext } from '@cryptoeconomicslab/context'
setupContext({ coder: Coder })

describe('CompiledDecider', () => {
  const TestPredicateAddress = Address.from(
    '0x0250035000301010002000900380005700060001'
  )

  const deciderManager = initializeDeciderManager()

  test('decide a property using compiled predicate', async () => {
    // An instance of compiled predicate "TestF(TestF, 10)".
    const property = new Property(TestPredicateAddress, [
      PredicateLabel.from('TestF'),
      Coder.encode(BigNumber.from(10))
    ])

    // Sets instance of CompiledDecider TestF
    const compiledPredicate = CompiledPredicate.fromSource(
      TestPredicateAddress,
      testSource,
      { zero: Coder.encode(BigNumber.from(0)).toHexString() }
    )
    const compiledDecider = new CompiledDecider(compiledPredicate)
    deciderManager.setDecider(TestPredicateAddress, compiledDecider)

    // TestF calls TestFA during deciding
    const decision = await compiledDecider.decide(
      deciderManager,
      property.inputs,
      {}
    )

    expect(decision).toEqual({
      witnesses: undefined,
      challenge: null,
      outcome: true
    })
  })

  test('false decision for ForAll', async () => {
    const source = `@library
    @quantifier("range,NUMBER,\${zero}-\${upper_bound}")
    def LessThan(n, upper_bound) :=
      IsLessThan(n, upper_bound)
        
    def test(a, c) := LessThan(a).all(b -> IsLessThan(c, b) and Bool(b))
    `

    // An instance of compiled predicate "TestF(TestF, 10, 5)".
    const property = new Property(TestPredicateAddress, [
      PredicateLabel.from('TestF'),
      Coder.encode(BigNumber.from(10)),
      Coder.encode(BigNumber.from(5))
    ])

    // Sets instance of CompiledDecider TestF
    const compiledPredicate = CompiledPredicate.fromSource(
      TestPredicateAddress,
      source,
      { zero: Coder.encode(BigNumber.from(0)).toHexString() }
    )
    const compiledDecider = new CompiledDecider(compiledPredicate)
    deciderManager.setDecider(TestPredicateAddress, compiledDecider)

    // TestF calls TestFA during deciding
    const decision = await compiledDecider.decide(
      deciderManager,
      property.inputs,
      {}
    )

    const notAddress = deciderManager.getDeciderAddress(LogicalConnective.Not)

    const challengeProperty = new Property(
      deciderManager.getDeciderAddress(LogicalConnective.And),
      [
        Coder.encode(
          new Property(IsLessThanDeciderAddress, [
            Coder.encode(BigNumber.from(0)),
            Coder.encode(BigNumber.from(10))
          ]).toStruct()
        ),
        Coder.encode(
          new Property(notAddress, [
            Coder.encode(
              new Property(TestPredicateAddress, [
                PredicateLabel.from('TestFO2A'),
                Coder.encode(BigNumber.from(5)),
                Coder.encode(BigNumber.from(0))
              ]).toStruct()
            )
          ]).toStruct()
        )
      ]
    )

    expect(decision.challenge).toStrictEqual({
      challengeInputs: [Coder.encode(BigNumber.from(0))],
      property: challengeProperty
    })

    // Check the snapshot of decider
    expect(decision.traceInfo?.toJson()).toEqual({
      predicateName: 'ForAllSuchThat',
      variable: '0x223022',
      child: {
        predicateName: 'Or',
        children: [
          {
            predicateName: 'NotDecider',
            inputs: [
              '0x5b22307830303030303030303030303030303030303030303030303030303030303030303030303030303232222c5b223078323233303232222c2230783232333133303232225d5d'
            ]
          },
          {
            predicateName: 'And',
            index: 0,
            child: {
              predicateName: 'IsLessThanDecider',
              inputs: ['0x223522', '0x223022']
            }
          }
        ]
      }
    })
  })

  test('false decision for ThereExists', async () => {
    const source = `@library
    @quantifier("range,NUMBER,\${zero}-\${upper_bound}")
    def LessThan(n, upper_bound) :=
      IsLessThan(n, upper_bound)
        
    def test(a, c) := LessThan(a).any(b -> Equal(c, b))
    `
    // An instance of compiled predicate "TestF(TestF, 10, 5)".
    const property = new Property(TestPredicateAddress, [
      PredicateLabel.from('TestT'),
      Coder.encode(BigNumber.from(5)),
      Coder.encode(BigNumber.from(10))
    ])

    // Sets instance of CompiledDecider TestF
    const compiledPredicate = CompiledPredicate.fromSource(
      TestPredicateAddress,
      source,
      { zero: Coder.encode(BigNumber.from(0)).toHexString() }
    )
    const compiledDecider = new CompiledDecider(compiledPredicate)
    deciderManager.setDecider(TestPredicateAddress, compiledDecider)

    // TestF calls TestFA during deciding
    const decision = await compiledDecider.decide(
      deciderManager,
      property.inputs,
      {}
    )

    const notAddress = deciderManager.getDeciderAddress(LogicalConnective.Not)

    const challengeProperty = new Property(ForAllSuchThatDeciderAddress, [
      Bytes.fromString(''),
      Bytes.fromString('b'),
      Coder.encode(
        new Property(notAddress, [
          Coder.encode(
            new Property(TestPredicateAddress, [
              PredicateLabel.from('TestTA'),
              FreeVariable.from('b'),
              Coder.encode(BigNumber.from(5)),
              Coder.encode(BigNumber.from(10))
            ]).toStruct()
          )
        ]).toStruct()
      )
    ])

    expect(decision.challenge).toStrictEqual({
      challengeInputs: [],
      property: challengeProperty
    })

    // Check the snapshot of decider
    expect(decision.traceInfo?.toJson()).toEqual({
      predicateName: 'ThereExistsSuchThat',
      child: {
        predicateName: 'And',
        index: 1,
        child: {
          predicateName: 'EqualDecider',
          inputs: ['0x22313022', '0x223022']
        }
      }
    })
  })
})
