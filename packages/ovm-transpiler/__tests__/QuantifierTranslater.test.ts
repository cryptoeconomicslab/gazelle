import {
  applyLibraries,
  createQuantifierPreset,
  replaceHint,
  replaceInputs
} from '../src/QuantifierTranslater'
import {
  PropertyDef,
  PropertyNode,
  Parser
} from '@cryptoeconomicslab/ovm-parser'
import Coder from '@cryptoeconomicslab/coder'
import { setupContext } from '@cryptoeconomicslab/context'
setupContext({ coder: Coder })

describe('QuantifierTranslater', () => {
  describe('applyLibraries', () => {
    test('nested library application', () => {
      const parser = new Parser()
      const library: PropertyDef[] = applyLibraries(
        parser.parse(`
@library
@quantifier("v,KEY,\${c2}")
def Q3(v: Bytes, c: Bytes, c2: Bytes) := Equal(v, c2)

@library
@quantifier("v.\${b2},KEY,\${b}")
def Q2(v: Bytes, b: Bytes, b2: Bytes) := Q3(v, b).any()

@library
@quantifier("v,KEY,\${a}")
def Q1(v: Bytes, a: Bytes) := Equal(v, a)`).declarations,
        []
      )

      const input = parser.parse(`
def origin(arg: Bytes) :=
  Q1(arg.0).all(q -> Q2(arg.0, q).all(q1 -> q1()))
      `).declarations
      const output = applyLibraries(input, library)
      expect(output).toStrictEqual([
        {
          name: 'origin',
          inputDefs: [{ name: 'arg', type: 'Bytes' }],
          body: {
            type: 'PropertyNode',
            predicate: 'ForAllSuchThat',
            inputs: [
              'v,KEY,${arg.0}',
              'q',
              {
                type: 'PropertyNode',
                predicate: 'Or',
                inputs: [
                  {
                    type: 'PropertyNode',
                    predicate: 'Not',
                    inputs: [
                      {
                        type: 'PropertyNode',
                        predicate: 'Equal',
                        inputs: ['q', 'arg.0']
                      }
                    ]
                  },
                  {
                    type: 'PropertyNode',
                    predicate: 'ForAllSuchThat',
                    inputs: [
                      'v.${q},KEY,${arg.0}',
                      'q1',
                      {
                        type: 'PropertyNode',
                        predicate: 'Or',
                        inputs: [
                          {
                            type: 'PropertyNode',
                            predicate: 'Not',
                            inputs: [
                              {
                                type: 'PropertyNode',
                                predicate: 'ThereExistsSuchThat',
                                inputs: [
                                  'v,KEY,${arg.0}',
                                  'v0',
                                  {
                                    type: 'PropertyNode',
                                    predicate: 'Equal',
                                    inputs: ['v0', 'arg.0']
                                  }
                                ]
                              }
                            ]
                          },
                          {
                            type: 'PropertyNode',
                            predicate: 'q1',
                            inputs: []
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          annotations: []
        }
      ])
    })

    test('SignedBy', () => {
      const input: PropertyDef[] = [
        {
          annotations: [],
          name: 'SignedByTest',
          inputDefs: [
            { name: 'a', type: 'Bytes' },
            { name: 'b', type: 'Bytes' }
          ],
          body: {
            type: 'PropertyNode',
            predicate: 'ThereExistsSuchThat',
            inputs: [
              {
                type: 'PropertyNode',
                predicate: 'SignedBy',
                inputs: ['a', 'b']
              }
            ]
          }
        }
      ]
      const library: PropertyDef[] = [
        {
          annotations: [
            {
              type: 'Annotation',
              body: {
                name: 'library',
                args: []
              }
            },
            {
              type: 'Annotation',
              body: {
                name: 'quantifier',
                args: ['signatures,KEY,${message}']
              }
            }
          ],
          name: 'SignedBy',
          inputDefs: [
            { name: 'sig', type: 'Bytes' },
            { name: 'message', type: 'Bytes' },
            { name: 'public_key', type: 'Address' }
          ],
          body: {
            type: 'PropertyNode',
            predicate: 'IsValidSignature',
            inputs: ['message', 'sig', 'public_key', '$secp256k1']
          }
        }
      ]
      const output = applyLibraries(input, library)
      expect(output).toStrictEqual([
        {
          annotations: [],
          name: 'SignedByTest',
          inputDefs: [
            { name: 'a', type: 'Bytes' },
            { name: 'b', type: 'Bytes' }
          ],
          body: {
            type: 'PropertyNode',
            predicate: 'ThereExistsSuchThat',
            inputs: [
              'signatures,KEY,${a}',
              'v0',
              {
                type: 'PropertyNode',
                predicate: 'IsValidSignature',
                inputs: ['a', 'v0', 'b', '$secp256k1']
              }
            ]
          }
        }
      ])
    })

    test('IsLessThan', () => {
      const input: PropertyDef[] = [
        {
          annotations: [],
          name: 'LessThanTest',
          inputDefs: [{ name: 'b', type: 'BigNumber' }],
          body: {
            type: 'PropertyNode',
            predicate: 'ForAllSuchThat',
            inputs: [
              {
                type: 'PropertyNode',
                predicate: 'IsLessThan',
                inputs: ['b']
              },
              'bb',
              {
                type: 'PropertyNode',
                predicate: 'Foo',
                inputs: ['bb']
              }
            ]
          }
        }
      ]
      const library: PropertyDef[] = [
        {
          annotations: [
            {
              type: 'Annotation',
              body: {
                name: 'library',
                args: []
              }
            },
            {
              type: 'Annotation',
              body: {
                name: 'quantifier',
                args: ['range,NUMBER,${zero}-${upper_bound}']
              }
            }
          ],
          name: 'IsLessThan',
          inputDefs: [
            { name: 'n', type: 'BigNumber' },
            { name: 'upper_bound', type: 'BigNumber' }
          ],
          body: {
            type: 'PropertyNode',
            predicate: 'IsLessThan',
            inputs: ['n', 'upper_bound']
          }
        }
      ]

      const output = applyLibraries(input, library, { zero: '0' })
      expect(output).toStrictEqual([
        {
          annotations: [],
          name: 'LessThanTest',
          inputDefs: [{ name: 'b', type: 'BigNumber' }],
          body: {
            type: 'PropertyNode',
            predicate: 'ForAllSuchThat',
            inputs: [
              'range,NUMBER,0-${b}',
              'bb',
              {
                type: 'PropertyNode',
                predicate: 'Or',
                inputs: [
                  {
                    type: 'PropertyNode',
                    predicate: 'Not',
                    inputs: [
                      {
                        type: 'PropertyNode',
                        predicate: 'IsLessThan',
                        inputs: ['bb', 'b']
                      }
                    ]
                  },
                  { type: 'PropertyNode', predicate: 'Foo', inputs: ['bb'] }
                ]
              }
            ]
          }
        }
      ])
    })

    test('SU', () => {
      const input: PropertyDef[] = [
        {
          annotations: [],
          name: 'SUTest',
          inputDefs: [
            { name: 'token', type: 'Address' },
            { name: 'range', type: 'Range' },
            { name: 'block', type: 'BigNumber' }
          ],
          body: {
            type: 'PropertyNode',
            predicate: 'ForAllSuchThat',
            inputs: [
              {
                type: 'PropertyNode',
                predicate: 'SU',
                inputs: ['token', 'range', 'block']
              },
              'su',
              {
                type: 'PropertyNode',
                predicate: 'Foo',
                inputs: ['su']
              }
            ]
          }
        }
      ]
      const parser = new Parser()
      const library: PropertyDef[] = applyLibraries(
        parser.parse(`
@library
@quantifier("proof.block\${b}.range\${t},RANGE,\${r}")
def IncludedAt(p: Bytes, l: Bytes, t: Address, r: Range, b: BigNumber) := 
  VerifyInclusion(l, t, r, b, p)

@library
def IncludedWithin(su: Bytes, b: BigNumber, t: Address, r: Range) := 
  IncludedAt(su, su.0, su.1, b).any()
  and Equal(su.0, t)
  and HasIntersection(su.1, range)
        
@library
@quantifier("su.block\${token}.range\${range},RANGE,\${block}")
def SU(su: Bytes, token: Address, range: Range, block: BigNumber) := IncludedWithin(su, block, token, range)
      `).declarations,
        []
      )
      const output = applyLibraries(input, library)
      expect(output).toStrictEqual([
        {
          annotations: [],
          name: 'SUTest',
          inputDefs: [
            { name: 'token', type: 'Address' },
            { name: 'range', type: 'Range' },
            { name: 'block', type: 'BigNumber' }
          ],
          body: {
            type: 'PropertyNode',
            predicate: 'ForAllSuchThat',
            inputs: [
              'su.block${token}.range${range},RANGE,${block}',
              'su',
              {
                type: 'PropertyNode',
                predicate: 'Or',
                inputs: [
                  {
                    type: 'PropertyNode',
                    predicate: 'Not',
                    inputs: [
                      {
                        type: 'PropertyNode',
                        predicate: 'And',
                        inputs: [
                          {
                            type: 'PropertyNode',
                            predicate: 'ThereExistsSuchThat',
                            inputs: [
                              'proof.block${b}.range${su.0},RANGE,${su.1}',
                              'v0',
                              {
                                type: 'PropertyNode',
                                predicate: 'VerifyInclusion',
                                inputs: ['su', 'su.0', 'su.1', 'block', 'v0']
                              }
                            ]
                          },
                          {
                            type: 'PropertyNode',
                            predicate: 'Equal',
                            inputs: ['su.0', 'token']
                          },
                          {
                            type: 'PropertyNode',
                            predicate: 'HasIntersection',
                            inputs: ['su.1', 'range']
                          }
                        ]
                      }
                    ]
                  },
                  { type: 'PropertyNode', predicate: 'Foo', inputs: ['su'] }
                ]
              }
            ]
          }
        }
      ])
    })

    test('Tx', () => {
      const input: PropertyDef[] = [
        {
          annotations: [],
          name: 'TxTest',
          inputDefs: [
            { name: 'token', type: 'Address' },
            { name: 'range', type: 'Range' },
            { name: 'block', type: 'BigNumber' }
          ],
          body: {
            type: 'PropertyNode',
            predicate: 'ThereExistsSuchThat',
            inputs: [
              {
                type: 'PropertyNode',
                predicate: 'Tx',
                inputs: ['token', 'range', 'block']
              },
              'tx',
              {
                type: 'PropertyNode',
                predicate: 'Foo',
                inputs: ['tx']
              }
            ]
          }
        }
      ]
      const parser = new Parser()
      const library: PropertyDef[] = parser.parse(`
@library
def IsTx(tx: Bytes, t: Address, r: Range, b: BigNumber) := 
  Equal(tx.address, $TransactionAddress)
  and Equal(tx.0, t)
  and HasIntersection(tx.1, range)
  and IsLessThan(tx.2, b)
        
@library
@quantifier("tx.block\${block}.range\${token},RANGE,\${range}")
def Tx(tx: Bytes, token: Address, range: Range, block: BigNumber) := IsTx(tx, token, range, block)
      `).declarations
      const output = applyLibraries(input, library)
      expect(output).toStrictEqual([
        {
          annotations: [],
          name: 'TxTest',
          inputDefs: [
            { name: 'token', type: 'Address' },
            { name: 'range', type: 'Range' },
            { name: 'block', type: 'BigNumber' }
          ],
          body: {
            type: 'PropertyNode',
            predicate: 'ThereExistsSuchThat',
            inputs: [
              'tx.block${block}.range${token},RANGE,${range}',
              'tx',
              {
                type: 'PropertyNode',
                predicate: 'And',
                inputs: [
                  {
                    type: 'PropertyNode',
                    predicate: 'And',
                    inputs: [
                      {
                        type: 'PropertyNode',
                        predicate: 'Equal',
                        inputs: ['tx.address', '$TransactionAddress']
                      },
                      {
                        type: 'PropertyNode',
                        predicate: 'Equal',
                        inputs: ['tx.0', 'token']
                      },
                      {
                        type: 'PropertyNode',
                        predicate: 'HasIntersection',
                        inputs: ['tx.1', 'range']
                      },
                      {
                        type: 'PropertyNode',
                        predicate: 'IsLessThan',
                        inputs: ['tx.2', 'block']
                      }
                    ]
                  },
                  { type: 'PropertyNode', predicate: 'Foo', inputs: ['tx'] }
                ]
              }
            ]
          }
        }
      ])
    })

    test('Optimizing ThereExistsSuchThat Quantifier', () => {
      // related issue is https://github.com/cryptoeconomicslab/gazelle/issues/267
      const input: PropertyDef[] = [
        {
          annotations: [],
          name: 'OptimisingThereExistsSuchThatTest',
          inputDefs: [
            { name: 'message', type: 'Bytes' },
            { name: 'owner', type: 'Address' }
          ],
          body: {
            type: 'PropertyNode',
            predicate: 'ThereExistsSuchThat',
            inputs: [
              {
                type: 'PropertyNode',
                predicate: 'SignedBy',
                inputs: ['message', 'owner']
              },
              'sig',
              {
                type: 'PropertyNode',
                predicate: 'And',
                inputs: [
                  {
                    type: 'PropertyNode',
                    predicate: 'Bool',
                    inputs: ['sig']
                  },
                  {
                    type: 'PropertyNode',
                    predicate: 'Bool',
                    inputs: ['sig']
                  }
                ]
              }
            ]
          }
        }
      ]
      const parser = new Parser()
      const library: PropertyDef[] = parser.parse(`
@library
@quantifier("signatures,KEY,\${message}")
def SignedBy(sig: Bytes, message: Bytes, owner: Address) := IsValidSignature(message, sig, owner)
      `).declarations
      const output = applyLibraries(input, library)
      expect(output).toStrictEqual([
        {
          annotations: [],
          name: 'OptimisingThereExistsSuchThatTest',
          inputDefs: [
            { name: 'message', type: 'Bytes' },
            { name: 'owner', type: 'Address' }
          ],
          body: {
            type: 'PropertyNode',
            predicate: 'ThereExistsSuchThat',
            inputs: [
              'signatures,KEY,${message}',
              'sig',
              {
                type: 'PropertyNode',
                predicate: 'And',
                inputs: [
                  {
                    type: 'PropertyNode',
                    predicate: 'IsValidSignature',
                    inputs: ['message', 'sig', 'owner']
                  },
                  { type: 'PropertyNode', predicate: 'Bool', inputs: ['sig'] },
                  { type: 'PropertyNode', predicate: 'Bool', inputs: ['sig'] }
                ]
              }
            ]
          }
        }
      ])
    })
  })

  describe('replaceInputs', () => {
    const node: PropertyNode = {
      type: 'PropertyNode',
      predicate: 'ThereExistsSuchThat',
      inputs: [
        {
          type: 'PropertyNode',
          predicate: 'SignedBy',
          inputs: ['a', 'b']
        }
      ]
    }
    test('replace inputs', () => {
      expect(
        replaceInputs(
          node,
          ['aa', 'bb'],
          [
            { name: 'a', type: 'Bytes' },
            { name: 'b', type: 'Bytes' }
          ]
        )
      ).toStrictEqual({
        type: 'PropertyNode',
        predicate: 'ThereExistsSuchThat',
        inputs: [
          {
            type: 'PropertyNode',
            predicate: 'SignedBy',
            inputs: ['aa', 'bb']
          }
        ]
      })
    })

    test('throw error', () => {
      expect(() =>
        replaceInputs(
          node,
          ['aa'],
          [
            { name: 'a', type: 'Bytes' },
            { name: 'b', type: 'Bytes' }
          ]
        )
      ).toThrowError(
        'The size of inputDefs must be less than or equal the size of callingInputs at ThereExistsSuchThat.'
      )
    })
  })

  describe('replaceHint', () => {
    test('replace hint', () => {
      expect(replaceHint('a,b,${param}', { param: 'c' })).toStrictEqual('a,b,c')
    })

    test('replace hint replace itself', () => {
      expect(replaceHint('a,b,${q}', { q: '${q}' })).toStrictEqual('a,b,${q}')
    })

    test('replace hint replace itself with comma', () => {
      expect(replaceHint('a,b,${su.0}', { 'su.0': '${su.0}' })).toStrictEqual(
        'a,b,${su.0}'
      )
    })
  })

  describe('createQuantifierPreset', () => {
    const library: PropertyDef = {
      annotations: [
        {
          type: 'Annotation',
          body: {
            name: 'library',
            args: []
          }
        },
        {
          type: 'Annotation',
          body: {
            name: 'quantifier',
            args: ['bucket.${a},KEY,${b}']
          }
        }
      ],
      name: 'FooLib',
      inputDefs: [
        { name: 'v', type: 'Bytes' },
        { name: 'a', type: 'Bytes' },
        { name: 'b', type: 'Bytes' }
      ],
      body: {
        type: 'PropertyNode',
        predicate: 'Foo',
        inputs: ['a', 'v', 'b']
      }
    }

    test('create quantifier preset', () => {
      const node: PropertyNode = {
        type: 'PropertyNode',
        predicate: 'FooLib',
        inputs: ['aa', 'bb']
      }
      const preset = createQuantifierPreset(library)
      expect(preset).not.toBeNull()
      if (preset !== null) {
        expect(preset.name).toStrictEqual('FooLib')
        expect(preset.translate(node, 'var_name')).toStrictEqual({
          hint: 'bucket.${aa},KEY,${bb}',
          property: {
            inputs: ['aa', 'var_name', 'bb'],
            predicate: 'Foo',
            type: 'PropertyNode'
          }
        })
      }
    })
  })
})
