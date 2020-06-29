import { createCompiledPredicates } from '../src/ContractCompiler'
import { PropertyDef } from '@cryptoeconomicslab/ovm-parser'
import { LogicalConnective } from '../src/CompiledPredicate'

describe('ContractCompiler', () => {
  beforeEach(async () => {})
  describe('createCompiledPredicates', () => {
    describe('operator', () => {
      test('and', () => {
        const input: PropertyDef[] = [
          {
            annotations: [],
            name: 'andTest',
            inputDefs: [
              { name: 'a', type: 'BigNumber' },
              { name: 'b', type: 'BigNumber' }
            ],
            body: {
              type: 'PropertyNode',
              predicate: 'And',
              inputs: [
                { type: 'PropertyNode', predicate: 'Bool', inputs: ['a'] },
                {
                  type: 'PropertyNode',
                  predicate: 'IsValidSignature',
                  inputs: ['b']
                }
              ]
            }
          }
        ]
        const output = createCompiledPredicates(input)
        expect(output).toStrictEqual([
          {
            type: 'CompiledPredicate',
            name: 'AndTest',
            inputDefs: [
              { name: 'a', type: 'BigNumber' },
              { name: 'b', type: 'BigNumber' }
            ],
            contracts: [
              {
                type: 'IntermediateCompiledPredicate',
                originalPredicateName: 'AndTest',
                name: 'AndTestA',
                connective: LogicalConnective.And,
                hasDecideMethod: true,
                inputDefs: ['AndTestA', 'a', 'b'],
                inputs: [
                  {
                    type: 'AtomicProposition',
                    predicate: { type: 'AtomicPredicateCall', source: 'Bool' },
                    inputs: [
                      { type: 'NormalInput', inputIndex: 1, children: [] }
                    ]
                  },
                  {
                    type: 'AtomicProposition',
                    predicate: {
                      type: 'AtomicPredicateCall',
                      source: 'IsValidSignature'
                    },
                    inputs: [
                      { type: 'NormalInput', inputIndex: 2, children: [] }
                    ]
                  }
                ],
                propertyInputs: []
              }
            ],
            entryPoint: 'AndTestA',
            entryPointOfDecide: 'AndTestA'
          }
        ])
      })
      test('or', () => {
        const input: PropertyDef[] = [
          {
            annotations: [],
            name: 'orTest',
            inputDefs: [
              { name: 'a', type: 'BigNumber' },
              { name: 'b', type: 'BigNumber' }
            ],
            body: {
              type: 'PropertyNode',
              predicate: 'Or',
              inputs: [
                { type: 'PropertyNode', predicate: 'Bool', inputs: ['a'] },
                {
                  type: 'PropertyNode',
                  predicate: 'IsValidSignature',
                  inputs: ['b']
                }
              ]
            }
          }
        ]
        const output = createCompiledPredicates(input)
        expect(output).toStrictEqual([
          {
            type: 'CompiledPredicate',
            name: 'OrTest',
            inputDefs: [
              { name: 'a', type: 'BigNumber' },
              { name: 'b', type: 'BigNumber' }
            ],
            contracts: [
              {
                type: 'IntermediateCompiledPredicate',
                originalPredicateName: 'OrTest',
                name: 'OrTestO',
                connective: LogicalConnective.Or,
                hasDecideMethod: true,
                inputDefs: ['OrTestO', 'a', 'b'],
                inputs: [
                  {
                    type: 'AtomicProposition',
                    predicate: { type: 'AtomicPredicateCall', source: 'Bool' },
                    inputs: [
                      { type: 'NormalInput', inputIndex: 1, children: [] }
                    ]
                  },
                  {
                    type: 'AtomicProposition',
                    predicate: {
                      type: 'AtomicPredicateCall',
                      source: 'IsValidSignature'
                    },
                    inputs: [
                      { type: 'NormalInput', inputIndex: 2, children: [] }
                    ]
                  }
                ],
                propertyInputs: []
              }
            ],
            entryPoint: 'OrTestO',
            entryPointOfDecide: 'OrTestO'
          }
        ])
      })
      test('not', () => {
        const input: PropertyDef[] = [
          {
            annotations: [],
            name: 'notTest',
            inputDefs: [{ name: 'a', type: 'BigNumber' }],
            body: {
              type: 'PropertyNode',
              predicate: 'Not',
              inputs: [
                { type: 'PropertyNode', predicate: 'Bool', inputs: ['a'] }
              ]
            }
          }
        ]
        const output = createCompiledPredicates(input)
        expect(output).toStrictEqual([
          {
            type: 'CompiledPredicate',
            name: 'NotTest',
            inputDefs: [{ name: 'a', type: 'BigNumber' }],
            contracts: [
              {
                type: 'IntermediateCompiledPredicate',
                originalPredicateName: 'NotTest',
                name: 'NotTestN',
                connective: LogicalConnective.Not,
                hasDecideMethod: false,
                inputDefs: ['NotTestN', 'a'],
                inputs: [
                  {
                    type: 'AtomicProposition',
                    predicate: { type: 'AtomicPredicateCall', source: 'Bool' },
                    inputs: [
                      { type: 'NormalInput', inputIndex: 1, children: [] }
                    ]
                  }
                ],
                propertyInputs: []
              }
            ],
            entryPoint: 'NotTestN',
            entryPointOfDecide: undefined
          }
        ])
      })
      test('forall', () => {
        const input: PropertyDef[] = [
          {
            annotations: [],
            name: 'forallTest',
            inputDefs: [{ name: 'a', type: 'BigNumber' }],
            body: {
              type: 'PropertyNode',
              predicate: 'ForAllSuchThat',
              inputs: [
                { type: 'PropertyNode', predicate: 'Equal', inputs: ['a'] },
                'b',
                { type: 'PropertyNode', predicate: 'Bool', inputs: ['b'] }
              ]
            }
          }
        ]
        const output = createCompiledPredicates(input)
        expect(output).toStrictEqual([
          {
            type: 'CompiledPredicate',
            name: 'ForallTest',
            inputDefs: [{ name: 'a', type: 'BigNumber' }],
            contracts: [
              {
                type: 'IntermediateCompiledPredicate',
                originalPredicateName: 'ForallTest',
                name: 'ForallTestF',
                connective: LogicalConnective.ForAllSuchThat,
                hasDecideMethod: false,
                inputDefs: ['ForallTestF', 'a'],
                inputs: [
                  {
                    type: 'AtomicProposition',
                    predicate: { type: 'AtomicPredicateCall', source: 'Equal' },
                    inputs: [
                      { type: 'NormalInput', inputIndex: 1, children: [] }
                    ]
                  },
                  'b',
                  {
                    type: 'AtomicProposition',
                    predicate: { type: 'AtomicPredicateCall', source: 'Bool' },
                    inputs: [
                      {
                        type: 'VariableInput',
                        placeholder: 'b',
                        children: []
                      }
                    ]
                  }
                ],
                propertyInputs: []
              }
            ],
            entryPoint: 'ForallTestF',
            entryPointOfDecide: undefined
          }
        ])
      })
      test('there', () => {
        const input: PropertyDef[] = [
          {
            annotations: [],
            name: 'thereTest',
            inputDefs: [],
            body: {
              type: 'PropertyNode',
              predicate: 'ThereExistsSuchThat',
              inputs: [
                'hint:hint:hint',
                'a',
                { type: 'PropertyNode', predicate: 'Bool', inputs: ['a'] }
              ]
            }
          }
        ]
        const output = createCompiledPredicates(input)
        expect(output).toStrictEqual([
          {
            type: 'CompiledPredicate',
            name: 'ThereTest',
            inputDefs: [],
            contracts: [
              {
                type: 'IntermediateCompiledPredicate',
                originalPredicateName: 'ThereTest',
                name: 'ThereTestT',
                connective: LogicalConnective.ThereExistsSuchThat,
                hasDecideMethod: true,
                inputDefs: ['ThereTestT'],
                inputs: [
                  'hint:hint:hint',
                  'a',
                  {
                    type: 'AtomicProposition',
                    predicate: { type: 'AtomicPredicateCall', source: 'Bool' },
                    inputs: [
                      {
                        type: 'VariableInput',
                        placeholder: 'a',
                        children: []
                      }
                    ]
                  }
                ],
                propertyInputs: []
              }
            ],
            entryPoint: 'ThereTestT',
            entryPointOfDecide: 'ThereTestT'
          }
        ])
      })
    })
    describe('bind', () => {
      test('bindand', () => {
        const input: PropertyDef[] = [
          {
            annotations: [],
            name: 'bindAndTest',
            inputDefs: [{ name: 'a', type: 'BigNumber' }],
            body: {
              type: 'PropertyNode',
              predicate: 'And',
              inputs: [
                { type: 'PropertyNode', predicate: 'Bool', inputs: ['a.0'] },
                {
                  type: 'PropertyNode',
                  predicate: 'IsValidSignature',
                  inputs: ['a.1']
                }
              ]
            }
          }
        ]
        const output = createCompiledPredicates(input)
        expect(output).toStrictEqual([
          {
            type: 'CompiledPredicate',
            name: 'BindAndTest',
            inputDefs: [{ name: 'a', type: 'BigNumber' }],
            contracts: [
              {
                type: 'IntermediateCompiledPredicate',
                originalPredicateName: 'BindAndTest',
                name: 'BindAndTestA',
                connective: LogicalConnective.And,
                hasDecideMethod: true,
                inputDefs: ['BindAndTestA', 'a'],
                inputs: [
                  {
                    type: 'AtomicProposition',
                    predicate: { type: 'AtomicPredicateCall', source: 'Bool' },
                    inputs: [
                      { type: 'NormalInput', inputIndex: 1, children: [0] }
                    ]
                  },
                  {
                    type: 'AtomicProposition',
                    predicate: {
                      type: 'AtomicPredicateCall',
                      source: 'IsValidSignature'
                    },
                    inputs: [
                      { type: 'NormalInput', inputIndex: 1, children: [1] }
                    ]
                  }
                ],
                propertyInputs: [
                  { type: 'NormalInput', inputIndex: 1, children: [] }
                ]
              }
            ],
            entryPoint: 'BindAndTestA',
            entryPointOfDecide: 'BindAndTestA'
          }
        ])
      })
      test('bind2', () => {
        const input: PropertyDef[] = [
          {
            annotations: [],
            name: 'bind2Test',
            inputDefs: [{ name: 'a', type: 'BigNumber' }],
            body: {
              type: 'PropertyNode',
              predicate: 'And',
              inputs: [
                { type: 'PropertyNode', predicate: 'Bool', inputs: ['a.0'] },
                {
                  type: 'PropertyNode',
                  predicate: 'IsValidSignature',
                  inputs: ['a.1.2']
                }
              ]
            }
          }
        ]
        const output = createCompiledPredicates(input)
        expect(output).toStrictEqual([
          {
            type: 'CompiledPredicate',
            name: 'Bind2Test',
            inputDefs: [{ name: 'a', type: 'BigNumber' }],
            contracts: [
              {
                type: 'IntermediateCompiledPredicate',
                originalPredicateName: 'Bind2Test',
                name: 'Bind2TestA',
                connective: LogicalConnective.And,
                hasDecideMethod: true,
                inputDefs: ['Bind2TestA', 'a'],
                inputs: [
                  {
                    type: 'AtomicProposition',
                    predicate: { type: 'AtomicPredicateCall', source: 'Bool' },
                    inputs: [
                      { type: 'NormalInput', inputIndex: 1, children: [0] }
                    ]
                  },
                  {
                    type: 'AtomicProposition',
                    predicate: {
                      type: 'AtomicPredicateCall',
                      source: 'IsValidSignature'
                    },
                    inputs: [
                      { type: 'NormalInput', inputIndex: 1, children: [1, 2] }
                    ]
                  }
                ],
                propertyInputs: [
                  { type: 'NormalInput', inputIndex: 1, children: [1] }
                ]
              }
            ],
            entryPoint: 'Bind2TestA',
            entryPointOfDecide: 'Bind2TestA'
          }
        ])
      })
      test('bindval', () => {
        const input: PropertyDef[] = [
          {
            annotations: [],
            name: 'bindValTest',
            inputDefs: [{ name: 'a', type: 'BigNumber' }],
            body: {
              type: 'PropertyNode',
              predicate: 'ThereExistsSuchThat',
              inputs: [
                { type: 'PropertyNode', predicate: 'Bool', inputs: [] },
                'b',
                {
                  type: 'PropertyNode',
                  predicate: 'Bool',
                  inputs: ['b.0', 'a']
                }
              ]
            }
          }
        ]
        const output = createCompiledPredicates(input)
        expect(output).toStrictEqual([
          {
            type: 'CompiledPredicate',
            name: 'BindValTest',
            inputDefs: [{ name: 'a', type: 'BigNumber' }],
            contracts: [
              {
                type: 'IntermediateCompiledPredicate',
                originalPredicateName: 'BindValTest',
                name: 'BindValTestT',
                connective: LogicalConnective.ThereExistsSuchThat,
                hasDecideMethod: true,
                inputDefs: ['BindValTestT', 'a'],
                inputs: [
                  {
                    type: 'AtomicProposition',
                    predicate: { type: 'AtomicPredicateCall', source: 'Bool' },
                    inputs: []
                  },
                  'b',
                  {
                    type: 'AtomicProposition',
                    predicate: { type: 'AtomicPredicateCall', source: 'Bool' },
                    inputs: [
                      {
                        type: 'VariableInput',
                        placeholder: 'b',
                        children: [0]
                      },
                      { type: 'NormalInput', inputIndex: 1, children: [] }
                    ]
                  }
                ],
                propertyInputs: []
              }
            ],
            entryPoint: 'BindValTestT',
            entryPointOfDecide: 'BindValTestT'
          }
        ])
      })

      test('bindaddr', () => {
        const input: PropertyDef[] = [
          {
            annotations: [],
            name: 'bindAddrTest',
            inputDefs: [{ name: 'a', type: 'BigNumber' }],
            body: {
              type: 'PropertyNode',
              predicate: 'And',
              inputs: [
                {
                  type: 'PropertyNode',
                  predicate: 'Equal',
                  inputs: ['a.address', 'self.address']
                },
                {
                  type: 'PropertyNode',
                  predicate: 'IsValidSignature',
                  inputs: ['a.0']
                }
              ]
            }
          }
        ]
        const output = createCompiledPredicates(input)
        expect(output).toStrictEqual([
          {
            type: 'CompiledPredicate',
            name: 'BindAddrTest',
            inputDefs: [{ name: 'a', type: 'BigNumber' }],
            contracts: [
              {
                type: 'IntermediateCompiledPredicate',
                originalPredicateName: 'BindAddrTest',
                name: 'BindAddrTestA',
                connective: LogicalConnective.And,
                hasDecideMethod: true,
                inputDefs: ['BindAddrTestA', 'a'],
                inputs: [
                  {
                    type: 'AtomicProposition',
                    predicate: {
                      type: 'AtomicPredicateCall',
                      source: 'Equal'
                    },
                    inputs: [
                      {
                        type: 'NormalInput',
                        inputIndex: 1,
                        children: [-1]
                      },
                      { type: 'SelfInput', children: [-1] }
                    ]
                  },
                  {
                    type: 'AtomicProposition',
                    predicate: {
                      type: 'AtomicPredicateCall',
                      source: 'IsValidSignature'
                    },
                    inputs: [
                      { type: 'NormalInput', inputIndex: 1, children: [0] }
                    ]
                  }
                ],
                propertyInputs: [
                  { type: 'NormalInput', inputIndex: 1, children: [] }
                ]
              }
            ],
            entryPoint: 'BindAddrTestA',
            entryPointOfDecide: 'BindAddrTestA'
          }
        ])
      })
    })
    describe('variable', () => {
      test('eval1', () => {
        const input: PropertyDef[] = [
          {
            annotations: [],
            name: 'evalTest',
            inputDefs: [
              { name: 'a', type: 'BigNumber' },
              { name: 'b', type: 'BigNumber' }
            ],
            body: {
              type: 'PropertyNode',
              predicate: 'And',
              inputs: [
                { type: 'PropertyNode', predicate: 'Bool', inputs: ['a'] },
                { type: 'PropertyNode', predicate: 'b', inputs: [] }
              ]
            }
          }
        ]
        const output = createCompiledPredicates(input)
        expect(output).toStrictEqual([
          {
            type: 'CompiledPredicate',
            name: 'EvalTest',
            inputDefs: [
              { name: 'a', type: 'BigNumber' },
              { name: 'b', type: 'BigNumber' }
            ],
            contracts: [
              {
                type: 'IntermediateCompiledPredicate',
                originalPredicateName: 'EvalTest',
                name: 'EvalTestA',
                connective: LogicalConnective.And,
                hasDecideMethod: true,
                inputDefs: ['EvalTestA', 'a', 'b'],
                inputs: [
                  {
                    type: 'AtomicProposition',
                    predicate: { type: 'AtomicPredicateCall', source: 'Bool' },
                    inputs: [
                      { type: 'NormalInput', inputIndex: 1, children: [] }
                    ]
                  },
                  {
                    type: 'AtomicProposition',
                    predicate: {
                      type: 'InputPredicateCall',
                      source: {
                        type: 'NormalInput',
                        inputIndex: 2,
                        children: []
                      }
                    },
                    inputs: []
                  }
                ],
                propertyInputs: []
              }
            ],
            entryPoint: 'EvalTestA',
            entryPointOfDecide: 'EvalTestA'
          }
        ])
      })
      test('forval', () => {
        const input: PropertyDef[] = [
          {
            annotations: [],
            name: 'forValTest',
            inputDefs: [{ name: 'a', type: 'BigNumber' }],
            body: {
              type: 'PropertyNode',
              predicate: 'ForAllSuchThat',
              inputs: [
                { type: 'PropertyNode', predicate: 'Equal', inputs: ['a'] },
                'b',
                { type: 'PropertyNode', predicate: 'b', inputs: [] }
              ]
            }
          }
        ]
        const output = createCompiledPredicates(input)
        expect(output).toStrictEqual([
          {
            type: 'CompiledPredicate',
            name: 'ForValTest',
            inputDefs: [{ name: 'a', type: 'BigNumber' }],
            contracts: [
              {
                type: 'IntermediateCompiledPredicate',
                originalPredicateName: 'ForValTest',
                name: 'ForValTestF',
                connective: LogicalConnective.ForAllSuchThat,
                hasDecideMethod: false,
                inputDefs: ['ForValTestF', 'a'],
                inputs: [
                  {
                    type: 'AtomicProposition',
                    predicate: { type: 'AtomicPredicateCall', source: 'Equal' },
                    inputs: [
                      { type: 'NormalInput', inputIndex: 1, children: [] }
                    ]
                  },
                  'b',
                  {
                    type: 'AtomicProposition',
                    predicate: { type: 'VariablePredicateCall' },
                    inputs: []
                  }
                ],
                propertyInputs: []
              }
            ],
            entryPoint: 'ForValTestF',
            entryPointOfDecide: undefined
          }
        ])
      })
      test('thereval', () => {
        const input: PropertyDef[] = [
          {
            annotations: [],
            name: 'thereValTest',
            inputDefs: [],
            body: {
              type: 'PropertyNode',
              predicate: 'ThereExistsSuchThat',
              inputs: [
                { type: 'PropertyNode', predicate: 'Equal', inputs: [] },
                'a',
                { type: 'PropertyNode', predicate: 'a', inputs: [] }
              ]
            }
          }
        ]
        const output = createCompiledPredicates(input)
        expect(output).toStrictEqual([
          {
            type: 'CompiledPredicate',
            name: 'ThereValTest',
            inputDefs: [],
            contracts: [
              {
                type: 'IntermediateCompiledPredicate',
                originalPredicateName: 'ThereValTest',
                name: 'ThereValTestT',
                connective: LogicalConnective.ThereExistsSuchThat,
                hasDecideMethod: true,
                inputDefs: ['ThereValTestT'],
                inputs: [
                  {
                    type: 'AtomicProposition',
                    predicate: { type: 'AtomicPredicateCall', source: 'Equal' },
                    inputs: []
                  },
                  'a',
                  {
                    type: 'AtomicProposition',
                    predicate: { type: 'VariablePredicateCall' },
                    inputs: []
                  }
                ],
                propertyInputs: []
              }
            ],
            entryPoint: 'ThereValTestT',
            entryPointOfDecide: 'ThereValTestT'
          }
        ])
      })
      test('thereval2', () => {
        const input: PropertyDef[] = [
          {
            annotations: [],
            name: 'thereValTest',
            inputDefs: [{ name: 'a', type: 'BigNumber' }],
            body: {
              type: 'PropertyNode',
              predicate: 'ThereExistsSuchThat',
              inputs: [
                { type: 'PropertyNode', predicate: 'Bool', inputs: [] },
                'b',
                { type: 'PropertyNode', predicate: 'a', inputs: ['b'] }
              ]
            }
          }
        ]
        const output = createCompiledPredicates(input)
        expect(output).toStrictEqual([
          {
            type: 'CompiledPredicate',
            name: 'ThereValTest',
            inputDefs: [{ name: 'a', type: 'BigNumber' }],
            contracts: [
              {
                type: 'IntermediateCompiledPredicate',
                originalPredicateName: 'ThereValTest',
                name: 'ThereValTestT',
                connective: LogicalConnective.ThereExistsSuchThat,
                hasDecideMethod: true,
                inputDefs: ['ThereValTestT', 'a'],
                inputs: [
                  {
                    type: 'AtomicProposition',
                    predicate: { type: 'AtomicPredicateCall', source: 'Bool' },
                    inputs: []
                  },
                  'b',
                  {
                    type: 'AtomicProposition',
                    predicate: {
                      type: 'InputPredicateCall',
                      source: {
                        type: 'NormalInput',
                        inputIndex: 1,
                        children: []
                      }
                    },
                    inputs: [
                      {
                        type: 'VariableInput',
                        placeholder: 'b',
                        children: []
                      }
                    ]
                  }
                ],
                propertyInputs: []
              }
            ],
            entryPoint: 'ThereValTestT',
            entryPointOfDecide: 'ThereValTestT'
          }
        ])
      })
    })
    describe('library', () => {
      test('decide other compiled predicates', () => {
        const input: PropertyDef[] = [
          {
            annotations: [],
            name: 'libraryTest',
            inputDefs: [
              { name: 'a', type: 'BigNumber' },
              { name: 'b', type: 'BigNumber' }
            ],
            body: {
              type: 'PropertyNode',
              predicate: 'And',
              inputs: [
                {
                  type: 'PropertyNode',
                  predicate: 'LibraryPredicate',
                  inputs: ['a']
                },
                { type: 'PropertyNode', predicate: 'Bool', inputs: [] }
              ]
            }
          }
        ]
        const output = createCompiledPredicates(input)
        expect(output).toStrictEqual([
          {
            type: 'CompiledPredicate',
            name: 'LibraryTest',
            inputDefs: [
              { name: 'a', type: 'BigNumber' },
              { name: 'b', type: 'BigNumber' }
            ],
            contracts: [
              {
                type: 'IntermediateCompiledPredicate',
                originalPredicateName: 'LibraryTest',
                name: 'LibraryTestA',
                connective: LogicalConnective.And,
                hasDecideMethod: true,
                inputDefs: ['LibraryTestA', 'a', 'b'],
                inputs: [
                  {
                    type: 'AtomicProposition',
                    predicate: {
                      type: 'CompiledPredicateCall',
                      source: 'LibraryPredicate'
                    },
                    inputs: [
                      { type: 'NormalInput', inputIndex: 1, children: [] }
                    ]
                  },
                  {
                    type: 'AtomicProposition',
                    predicate: {
                      type: 'AtomicPredicateCall',
                      source: 'Bool'
                    },
                    inputs: []
                  }
                ],
                propertyInputs: []
              }
            ],
            constants: [
              {
                name: 'LibraryPredicate',
                varType: 'address'
              }
            ],
            entryPoint: 'LibraryTestA',
            entryPointOfDecide: 'LibraryTestA'
          }
        ])
      })
    })

    describe('deep nest', () => {
      test('Bool(a) or (Bool(b) and Bool(c))', () => {
        const input: PropertyDef[] = [
          {
            annotations: [],
            name: 'DeepNestTest',
            inputDefs: [
              { name: 'a', type: 'BigNumber' },
              { name: 'b', type: 'BigNumber' },
              { name: 'c', type: 'BigNumber' }
            ],
            body: {
              type: 'PropertyNode',
              predicate: 'Or',
              inputs: [
                {
                  type: 'PropertyNode',
                  predicate: 'And',
                  inputs: [
                    { type: 'PropertyNode', predicate: 'Bool', inputs: ['a'] },
                    { type: 'PropertyNode', predicate: 'Bool', inputs: ['b'] }
                  ]
                },
                { type: 'PropertyNode', predicate: 'Bool', inputs: ['c'] }
              ]
            }
          }
        ]
        const output = createCompiledPredicates(input)
        expect(output).toStrictEqual([
          {
            type: 'CompiledPredicate',
            name: 'DeepNestTest',
            inputDefs: [
              { name: 'a', type: 'BigNumber' },
              { name: 'b', type: 'BigNumber' },
              { name: 'c', type: 'BigNumber' }
            ],
            contracts: [
              {
                type: 'IntermediateCompiledPredicate',
                originalPredicateName: 'DeepNestTest',
                name: 'DeepNestTestO1A',
                connective: 'And',
                hasDecideMethod: true,
                inputDefs: ['DeepNestTestO1A', 'a', 'b'],
                inputs: [
                  {
                    type: 'AtomicProposition',
                    predicate: { type: 'AtomicPredicateCall', source: 'Bool' },
                    inputs: [
                      { type: 'NormalInput', inputIndex: 1, children: [] }
                    ]
                  },
                  {
                    type: 'AtomicProposition',
                    predicate: { type: 'AtomicPredicateCall', source: 'Bool' },
                    inputs: [
                      { type: 'NormalInput', inputIndex: 2, children: [] }
                    ]
                  }
                ],
                propertyInputs: []
              },
              {
                type: 'IntermediateCompiledPredicate',
                originalPredicateName: 'DeepNestTest',
                name: 'DeepNestTestO',
                connective: 'Or',
                hasDecideMethod: true,
                inputDefs: ['DeepNestTestO', 'a', 'b', 'c'],
                inputs: [
                  {
                    type: 'AtomicProposition',
                    predicate: {
                      type: 'AtomicPredicateCall',
                      source: 'DeepNestTestO1A'
                    },
                    inputs: [
                      { type: 'LabelInput', label: 'DeepNestTestO1A' },
                      { type: 'NormalInput', inputIndex: 1, children: [] },
                      { type: 'NormalInput', inputIndex: 2, children: [] }
                    ],
                    isCompiled: true
                  },
                  {
                    type: 'AtomicProposition',
                    predicate: { type: 'AtomicPredicateCall', source: 'Bool' },
                    inputs: [
                      { type: 'NormalInput', inputIndex: 3, children: [] }
                    ]
                  }
                ],
                propertyInputs: []
              }
            ],
            entryPoint: 'DeepNestTestO',
            entryPointOfDecide: 'DeepNestTestO'
          }
        ])
      })

      test('Bool(a).any(c -> Bool(b) and Bool(c))', () => {
        const input: PropertyDef[] = [
          {
            name: 'deepNestTest',
            inputDefs: [
              { name: 'a', type: 'BigNumber' },
              { name: 'b', type: 'BigNumber' }
            ],
            body: {
              type: 'PropertyNode',
              predicate: 'ThereExistsSuchThat',
              inputs: [
                'hint',
                'c',
                {
                  type: 'PropertyNode',
                  predicate: 'And',
                  inputs: [
                    { type: 'PropertyNode', predicate: 'Bool', inputs: ['a'] },
                    { type: 'PropertyNode', predicate: 'Bool', inputs: ['b'] },
                    { type: 'PropertyNode', predicate: 'Bool', inputs: ['c'] }
                  ]
                }
              ]
            },
            annotations: []
          }
        ]
        const output = createCompiledPredicates(input)
        expect(output).toStrictEqual([
          {
            type: 'CompiledPredicate',
            name: 'DeepNestTest',
            inputDefs: [
              { name: 'a', type: 'BigNumber' },
              { name: 'b', type: 'BigNumber' }
            ],
            contracts: [
              {
                type: 'IntermediateCompiledPredicate',
                originalPredicateName: 'DeepNestTest',
                name: 'DeepNestTestTA',
                connective: 'And',
                hasDecideMethod: true,
                inputDefs: ['DeepNestTestTA', 'a', 'b', 'c'],
                inputs: [
                  {
                    type: 'AtomicProposition',
                    predicate: {
                      type: 'AtomicPredicateCall',
                      source: 'Bool'
                    },
                    inputs: [
                      { type: 'NormalInput', inputIndex: 1, children: [] }
                    ]
                  },
                  {
                    type: 'AtomicProposition',
                    predicate: {
                      type: 'AtomicPredicateCall',
                      source: 'Bool'
                    },
                    inputs: [
                      { type: 'NormalInput', inputIndex: 2, children: [] }
                    ]
                  },
                  {
                    type: 'AtomicProposition',
                    predicate: {
                      type: 'AtomicPredicateCall',
                      source: 'Bool'
                    },
                    inputs: [
                      { type: 'NormalInput', inputIndex: 3, children: [] }
                    ]
                  }
                ],
                propertyInputs: []
              },
              {
                type: 'IntermediateCompiledPredicate',
                originalPredicateName: 'DeepNestTest',
                name: 'DeepNestTestT',
                connective: 'ThereExistsSuchThat',
                hasDecideMethod: true,
                inputDefs: ['DeepNestTestT', 'a', 'b'],
                inputs: [
                  'hint',
                  'c',
                  {
                    type: 'AtomicProposition',
                    predicate: {
                      type: 'AtomicPredicateCall',
                      source: 'DeepNestTestTA'
                    },
                    inputs: [
                      { type: 'LabelInput', label: 'DeepNestTestTA' },
                      { type: 'NormalInput', inputIndex: 1, children: [] },
                      { type: 'NormalInput', inputIndex: 2, children: [] },
                      { type: 'VariableInput', placeholder: 'c', children: [] }
                    ],
                    isCompiled: true
                  }
                ],
                propertyInputs: []
              }
            ],
            entryPoint: 'DeepNestTestT',
            entryPointOfDecide: 'DeepNestTestT'
          }
        ])
      })
    })
  })
})
