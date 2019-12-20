import { transpiler } from 'ovm-compiler'
import { LogicalConnective } from 'ovm-compiler/dist/transpiler'

export const testSource: transpiler.CompiledPredicate = {
  type: 'CompiledPredicate',
  name: 'Test',
  inputDefs: ['a'],
  contracts: [
    {
      type: 'IntermediateCompiledPredicate',
      originalPredicateName: 'Test',
      name: 'TestFA',
      connective: LogicalConnective.And,
      inputDefs: ['TestFA', 'b'],
      inputs: [
        {
          type: 'AtomicProposition',
          predicate: { type: 'AtomicPredicateCall', source: 'Bool' },
          inputs: [{ type: 'NormalInput', inputIndex: 1, children: [] }]
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
      originalPredicateName: 'Test',
      name: 'TestF',
      connective: LogicalConnective.ForAllSuchThat,
      inputDefs: ['TestF', 'a'],
      inputs: [
        'range,NUMBER,0x00-${a}',
        'b',
        {
          type: 'AtomicProposition',
          predicate: { type: 'AtomicPredicateCall', source: 'TestFA' },
          inputs: [
            { type: 'LabelInput', label: 'TestFA' },
            { type: 'VariableInput', placeholder: 'b', children: [] }
          ]
        }
      ],
      propertyInputs: []
    }
  ],
  entryPoint: 'TestF'
}
