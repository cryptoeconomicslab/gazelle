import { transpile } from '../src/Transpiler'
import { Program } from '@cryptoeconomicslab/ovm-parser'
import Coder from '@cryptoeconomicslab/coder'
import { setupContext } from '@cryptoeconomicslab/context'
setupContext({ coder: Coder })

describe('Transpiler', () => {
  describe('transpile', () => {
    test('return transpiled object', () => {
      const program: Program = {
        imports: [
          {
            path: 'BoolQuantifier',
            module: 'BoolQuantifier'
          }
        ],
        declarations: [
          {
            name: 'deepNestTest',
            inputDefs: [
              { name: 'a', type: 'Bool' },
              { name: 'b', type: 'Bool' }
            ],
            body: {
              type: 'PropertyNode',
              predicate: 'ThereExistsSuchThat',
              inputs: [
                {
                  type: 'PropertyNode',
                  predicate: 'BoolQuantifier',
                  inputs: ['a']
                },
                'c',
                {
                  type: 'PropertyNode',
                  predicate: 'And',
                  inputs: [
                    { type: 'PropertyNode', predicate: 'Bool', inputs: ['b'] },
                    { type: 'PropertyNode', predicate: 'Bool', inputs: ['c'] }
                  ]
                }
              ]
            },
            annotations: []
          }
        ]
      }

      const compiledPredicates = transpile(program, _import => {
        return {
          imports: [],
          declarations: [
            {
              name: 'BoolQuantifier',
              inputDefs: [
                { name: 'a', type: 'Bool' },
                { name: 'b', type: 'Bool' }
              ],
              body: {
                type: 'PropertyNode',
                predicate: 'Bool',
                inputs: ['a', 'b']
              },
              annotations: [
                { type: 'Annotation', body: { name: 'library', args: [] } },
                {
                  type: 'Annotation',
                  body: { name: 'quantifier', args: ['hint'] }
                }
              ]
            }
          ]
        }
      })
      expect(compiledPredicates).toEqual([
        {
          type: 'CompiledPredicate',
          name: 'DeepNestTest',
          inputDefs: [
            { name: 'a', type: 'Bool' },
            { name: 'b', type: 'Bool' }
          ],
          contracts: [
            {
              type: 'IntermediateCompiledPredicate',
              originalPredicateName: 'DeepNestTest',
              name: 'DeepNestTestTA',
              connective: 'And',
              hasDecideMethod: true,
              inputDefs: ['DeepNestTestTA', 'c', 'a', 'b'],
              inputs: [
                {
                  type: 'AtomicProposition',
                  predicate: { type: 'AtomicPredicateCall', source: 'Bool' },
                  inputs: [
                    { type: 'NormalInput', inputIndex: 1, children: [] },
                    { type: 'NormalInput', inputIndex: 2, children: [] }
                  ]
                },
                {
                  type: 'AtomicProposition',
                  predicate: { type: 'AtomicPredicateCall', source: 'Bool' },
                  inputs: [{ type: 'NormalInput', inputIndex: 3, children: [] }]
                },
                {
                  type: 'AtomicProposition',
                  predicate: { type: 'AtomicPredicateCall', source: 'Bool' },
                  inputs: [{ type: 'NormalInput', inputIndex: 1, children: [] }]
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
                    { type: 'VariableInput', placeholder: 'c', children: [] },
                    { type: 'NormalInput', inputIndex: 1, children: [] },
                    { type: 'NormalInput', inputIndex: 2, children: [] }
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
