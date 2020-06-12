import {
  Property,
  FreeVariable,
  CompiledPredicate,
  createAtomicPropositionCall,
  constructInput,
  createSubstitutions,
  CompiledDecider,
  parseHintToGetVariables,
  parseVariable,
  PredicateLabel
} from '../../src'
import { Address, Bytes, BigNumber } from '@cryptoeconomicslab/primitives'
import {
  initializeDeciderManager,
  ForAllSuchThatDeciderAddress,
  AndDeciderAddress,
  SampleDeciderAddress as BoolDeciderAddress,
  EqualDeciderAddress,
  IsContainedDeciderAddress
} from '../helpers/initiateDeciderManager'
import Coder from '@cryptoeconomicslab/coder'
import { testSource } from './TestSource'
import { ethers } from 'ethers'
import { Range } from '@cryptoeconomicslab/primitives'
import { AtomicProposition } from '@cryptoeconomicslab/ovm-transpiler'
import { setupContext } from '@cryptoeconomicslab/context'
setupContext({ coder: Coder })

describe('CompiledPredicate', () => {
  const TestPredicateAddress = Address.from(
    '0x0250035000301010002000900380005700060001'
  )

  const deciderManager = initializeDeciderManager()
  const encodeProperty = (property: Property) =>
    Coder.encode(property.toStruct())
  const encodeBoolDecider = (input: Bytes) =>
    encodeProperty(new Property(BoolDeciderAddress, [input]))

  describe('restoreHint', () => {
    it('restote hint from compiled predicate', async () => {
      const compiledPredicate = CompiledPredicate.fromSource(
        TestPredicateAddress,
        `@library
@quantifier("bucket,RANGE,\${b}")
def SampleQuantifier(a, b) :=
  Bool(a, b) and Bool(a, b)

def test(a) := SampleQuantifier(a).any(b -> b())
`
      )
      const hint = compiledPredicate.restoreHint(
        new Property(TestPredicateAddress, [
          PredicateLabel.from('TestTA'),
          Coder.encode(BigNumber.from(1)),
          Coder.encode(BigNumber.from(2))
        ])
      )
      expect(hint.intoString()).toEqual('bucket,RANGE,0x223222')
    })
  })

  describe('decompileProperty', () => {
    const testOriginalProperty = {
      deciderAddress: ForAllSuchThatDeciderAddress,
      inputs: [
        Bytes.fromString(
          `range,NUMBER,${Coder.encode(
            BigNumber.from(0)
          ).toHexString()}-${Coder.encode(BigNumber.from(10)).toHexString()}`
        ),
        Bytes.fromString('b'),
        Coder.encode(
          new Property(TestPredicateAddress, [
            PredicateLabel.from('TestFO'),
            FreeVariable.from('b'),
            Coder.encode(BigNumber.from(10))
          ]).toStruct()
        )
      ]
    }
    let compiledPredicate: CompiledPredicate
    beforeEach(() => {
      compiledPredicate = CompiledPredicate.fromSource(
        TestPredicateAddress,
        testSource
      )
      console.log(compiledPredicate)
      deciderManager.setDecider(
        TestPredicateAddress,
        new CompiledDecider(compiledPredicate),
        'Test'
      )
    })

    it('compiled predicate using quantifier', async () => {
      // Create an instance of compiled predicate "TestF(TestF, 10)".
      const property = compiledPredicate.decompileProperty(
        new Property(TestPredicateAddress, [
          PredicateLabel.from('TestF'),
          Coder.encode(BigNumber.from(10))
        ]),
        deciderManager.shortnameMap
      )
      expect(property).toEqual(testOriginalProperty)
    })

    it('use default contract if label is not provided', async () => {
      // Create an instance of compiled predicate "Test(10)".
      const property = compiledPredicate.decompileProperty(
        new Property(TestPredicateAddress, [Coder.encode(BigNumber.from(10))]),
        deciderManager.shortnameMap
      )
      expect(property).toEqual(testOriginalProperty)
    })

    it('compiled predicate using logical connective', async () => {
      const compiledPredicateAnd = CompiledPredicate.fromSource(
        TestPredicateAddress,
        'def test(a, b) := Bool(a) and Bool(b)'
      )
      const testOriginalProperty = {
        deciderAddress: AndDeciderAddress,
        inputs: [
          encodeBoolDecider(Coder.encode(BigNumber.from(301))),
          encodeBoolDecider(Coder.encode(BigNumber.from(302)))
        ]
      }
      const property = compiledPredicateAnd.decompileProperty(
        new Property(TestPredicateAddress, [
          Coder.encode(BigNumber.from(301)),
          Coder.encode(BigNumber.from(302))
        ]),
        deciderManager.shortnameMap
      )
      expect(property).toEqual(testOriginalProperty)
    })

    it('compiled predicate using input predicate call', async () => {
      const compiledPredicateAnd = CompiledPredicate.fromSource(
        TestPredicateAddress,
        'def test(a, b) := a() and b()'
      )
      const testOriginalProperty = {
        deciderAddress: AndDeciderAddress,
        inputs: [
          encodeBoolDecider(Coder.encode(BigNumber.from(301))),
          encodeBoolDecider(Coder.encode(BigNumber.from(302)))
        ]
      }
      const property = compiledPredicateAnd.decompileProperty(
        new Property(TestPredicateAddress, [
          encodeBoolDecider(Coder.encode(BigNumber.from(301))),
          encodeBoolDecider(Coder.encode(BigNumber.from(302)))
        ]),
        deciderManager.shortnameMap
      )
      expect(property).toEqual(testOriginalProperty)
    })

    it('compiled predicate using variable predicate call', async () => {
      const txAddress = Address.from(ethers.constants.AddressZero)
      const txAddressBytes = Coder.encode(txAddress)
      const token = Coder.encode(Address.from(ethers.constants.AddressZero))
      const range = Coder.encode(
        new Range(BigNumber.from(0), BigNumber.from(100)).toStruct()
      )
      const block = Coder.encode(BigNumber.from(50))
      const so = Bytes.fromHexString('0x00')
      const tx = new Property(txAddress, [token, range, block, so])
      const compiledPredicateAnd = CompiledPredicate.fromSource(
        TestPredicateAddress,
        `@library
def IsValidTx(tx, token, range, block_number) :=
  Equal(tx.address, $TransactionAddress)
  and Equal(tx.0, token)
  and IsContained(range, tx.1)
  and Equal(block_number, tx.2)

@library
@quantifier("tx.block\${b}.range\${token},RANGE,\${range}")
def Tx(tx, token, range, b) :=
  IsValidTx(tx, token, range, b)

def test(token, range, block) := Tx(token, range, block).any(tx -> tx())`
      )
      const encodeEqDecider = (a: Bytes, b: Bytes) =>
        encodeProperty(new Property(EqualDeciderAddress, [a, b]))
      const encodeIsContainedDecider = (a: Bytes, b: Bytes) =>
        encodeProperty(new Property(IsContainedDeciderAddress, [a, b]))
      const testOriginalProperty = {
        deciderAddress: AndDeciderAddress,
        inputs: [
          encodeEqDecider(txAddressBytes, txAddressBytes),
          encodeEqDecider(token, token),
          encodeIsContainedDecider(range, range),
          encodeEqDecider(block, block)
        ]
      }
      const property = compiledPredicateAnd.decompileProperty(
        new Property(TestPredicateAddress, [
          PredicateLabel.from('TestTA1A'),
          encodeProperty(tx),
          token,
          range,
          block
        ]),
        deciderManager.shortnameMap,
        { TransactionAddress: txAddressBytes }
      )
      expect(property).toEqual(testOriginalProperty)
    })
  })

  describe('createAtomicPropositionCall', () => {
    const compiledPredicateAnd = CompiledPredicate.fromSource(
      TestPredicateAddress,
      'def test(a) := Bool(a) and Bool($b) and Bool(self.address) and LibraryPredicate(a)'
    )
    const definition = compiledPredicateAnd.compiled.contracts[0]
    const a = BigNumber.from(301)
    const compiledProperty = new Property(TestPredicateAddress, [
      PredicateLabel.from('TestA'),
      Coder.encode(a)
    ])
    const b = BigNumber.from(302)

    it('create atomic proposition call with normal input', async () => {
      expect(
        createAtomicPropositionCall(
          definition.inputs[0] as AtomicProposition,
          definition,
          {
            compiledProperty,
            predicateTable: deciderManager.shortnameMap,
            constantTable: {}
          }
        )
      ).toEqual(encodeBoolDecider(Coder.encode(BigNumber.from(301))))
    })

    it('throw exception because not enough inputs', async () => {
      const invalidCompiledProperty = new Property(TestPredicateAddress, [])
      expect(() => {
        createAtomicPropositionCall(
          definition.inputs[0] as AtomicProposition,
          definition,
          {
            compiledProperty: invalidCompiledProperty,
            predicateTable: deciderManager.shortnameMap,
            constantTable: {}
          }
        )
      }).toThrowError(
        new Error(`Property(${TestPredicateAddress}) don't have enough inputs.`)
      )
    })

    it('create atomic proposition call with constant input', async () => {
      expect(
        createAtomicPropositionCall(
          definition.inputs[1] as AtomicProposition,
          definition,
          {
            compiledProperty,
            predicateTable: deciderManager.shortnameMap,
            constantTable: { b: Coder.encode(b) }
          }
        )
      ).toEqual(encodeBoolDecider(Coder.encode(b)))
    })

    it('create atomic proposition call with self input', async () => {
      expect(
        createAtomicPropositionCall(
          definition.inputs[2] as AtomicProposition,
          definition,
          {
            compiledProperty,
            predicateTable: deciderManager.shortnameMap,
            constantTable: {}
          }
        )
      ).toEqual(
        encodeBoolDecider(Bytes.fromHexString(TestPredicateAddress.data))
      )
    })

    it('create InputPredicateCall with extra inputs', () => {
      const compiledPredicate = CompiledPredicate.fromSource(
        TestPredicateAddress,
        'def test(a, b) := Bool(a) and a(b)'
      )
      const definition = compiledPredicate.compiled.contracts[0]
      const predicateCall = definition.inputs[1] as AtomicProposition
      const a = new Property(TestPredicateAddress, [
        PredicateLabel.from('TestA'),
        Coder.encode(BigNumber.from(301))
      ])
      const compiledProperty = new Property(TestPredicateAddress, [
        PredicateLabel.from('TestA'),
        Coder.encode(a.toStruct()),
        Coder.encode(b)
      ])
      const aWithB = new Property(TestPredicateAddress, [
        PredicateLabel.from('TestA'),
        Coder.encode(BigNumber.from(301)),
        Coder.encode(b)
      ])
      // expectedProperty is a(b)
      const expectedProperty = Coder.encode(aWithB.toStruct())
      expect(
        createAtomicPropositionCall(predicateCall, definition, {
          compiledProperty,
          predicateTable: deciderManager.shortnameMap,
          constantTable: {}
        })
      ).toEqual(expectedProperty)
    })

    it('creating InputPredicateCall does not support ConstantInput as extra', () => {
      const compiledPredicate = CompiledPredicate.fromSource(
        TestPredicateAddress,
        'def test(a) := Bool(a) and a($Constant)'
      )
      const definition = compiledPredicate.compiled.contracts[0]
      const predicateCall = definition.inputs[1] as AtomicProposition
      const a = new Property(TestPredicateAddress, [
        PredicateLabel.from('TestA'),
        Coder.encode(BigNumber.from(301))
      ])
      const compiledProperty = new Property(TestPredicateAddress, [
        PredicateLabel.from('TestA'),
        Coder.encode(a.toStruct())
      ])
      expect(() => {
        createAtomicPropositionCall(predicateCall, definition, {
          compiledProperty,
          predicateTable: deciderManager.shortnameMap,
          constantTable: { Constant: Bytes.default() }
        })
      }).toThrow("It doesn't support ConstantInput in InputPredicateCall")
    })

    it('create atomic proposition call with CompiledPredicateInput', async () => {
      const LibraryPredicateAddress = Address.from(
        '0x0250035000301010002bc0900380005700060001'
      )
      const encodeLibraryProperty = (input: Bytes) =>
        encodeProperty(new Property(LibraryPredicateAddress, [input]))
      const shortnameMap = new Map(deciderManager.shortnameMap)

      expect(() => {
        createAtomicPropositionCall(
          definition.inputs[3] as AtomicProposition,
          definition,
          {
            compiledProperty,
            predicateTable: shortnameMap,
            constantTable: {}
          }
        )
      }).toThrowError('The address of LibraryPredicate not found.')
      shortnameMap.set('LibraryPredicate', LibraryPredicateAddress)
      expect(
        createAtomicPropositionCall(
          definition.inputs[3] as AtomicProposition,
          definition,
          {
            compiledProperty,
            predicateTable: shortnameMap,
            constantTable: {}
          }
        )
      ).toEqual(encodeLibraryProperty(Coder.encode(a)))
    })
  })

  describe('constructInput', () => {
    const childAddress = Address.from(
      '0x0250035000301010002000900380005700060002'
    )
    const childPropertyBytes = Coder.encode(
      new Property(childAddress, [
        Bytes.fromString('0'),
        Bytes.fromString('1'),
        Bytes.fromString('2')
      ]).toStruct()
    )
    const propertyBytes = Coder.encode(
      new Property(TestPredicateAddress, [
        childPropertyBytes,
        Bytes.fromString('3')
      ]).toStruct()
    )
    it('return anInput bytes as it is', async () => {
      expect(constructInput(propertyBytes, [])).toEqual(propertyBytes)
    })

    it('return child input of property bytes', async () => {
      expect(constructInput(propertyBytes, [1])).toEqual(Bytes.fromString('3'))
      expect(constructInput(propertyBytes, [0, 0])).toEqual(
        Bytes.fromString('0')
      )
      expect(constructInput(propertyBytes, [0, 2])).toEqual(
        Bytes.fromString('2')
      )
    })

    it('return child address of property bytes', async () => {
      expect(constructInput(propertyBytes, [-1])).toEqual(
        Coder.encode(TestPredicateAddress)
      )
      expect(constructInput(propertyBytes, [0, -1])).toEqual(
        Coder.encode(childAddress)
      )
    })

    it('throw exception', async () => {
      expect(() => {
        constructInput(Bytes.fromString('invalid'), [1])
      }).toThrowError('Unexpected token i in JSON at position 0')
    })
  })

  describe('createSubstitutions', () => {
    const a = Bytes.fromString('a')
    const b = Bytes.fromString('b')
    it('return key Bytes map object', async () => {
      expect(
        createSubstitutions(
          ['a', 'b'],
          [a, b],
          [
            { name: 'a', children: [] },
            { name: 'b', children: [] }
          ]
        )
      ).toEqual({
        a,
        b
      })
    })
    it('throw exception because of less inputDefs', async () => {
      expect(() => {
        createSubstitutions(
          ['a'],
          [a],
          [
            { name: 'a', children: [] },
            { name: 'b', children: [] }
          ]
        )
      }).toThrowError('Invalid inputDescriptions b.')
    })
    it('return key Bytes map object with inputDescriptions', async () => {
      const predicateAddress = Address.from(
        '0x0250035000301010002000900380005700060002'
      )
      const nestedProperty = Coder.encode(
        new Property(predicateAddress, [a, b]).toStruct()
      )
      expect(
        createSubstitutions(
          ['a', 'b'],
          [nestedProperty, b],
          [
            { name: 'a', children: [] },
            { name: 'a', children: [0] },
            { name: 'b', children: [] }
          ]
        )
      ).toEqual({
        a: nestedProperty,
        'a.0': a,
        b
      })
    })
  })

  describe('parseHintToGetVariables', () => {
    it('return empty list', async () => {
      expect(parseHintToGetVariables('a,b,c')).toEqual([])
    })
    it('return variable list', async () => {
      expect(parseHintToGetVariables('${a},b,${c.0}')).toEqual(['a', 'c.0'])
    })
  })

  describe('parseVariable', () => {
    it('do not have children', async () => {
      expect(parseVariable('a')).toEqual({ name: 'a', children: [] })
    })
    it('return variable object', async () => {
      expect(parseVariable('a.0')).toEqual({ name: 'a', children: [0] })
    })
    it('return variable object with children', async () => {
      expect(parseVariable('a.0.1')).toEqual({ name: 'a', children: [0, 1] })
    })
  })
})
