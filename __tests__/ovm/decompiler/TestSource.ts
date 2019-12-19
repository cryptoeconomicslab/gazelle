import { transpiler } from 'ovm-compiler'

export const testSource: transpiler.CompiledPredicate = {
  type: 'CompiledPredicate',
  name: 'Test',
  inputDefs: ['a'],
  contracts: [
    {
      type: 'IntermediateCompiledPredicate',
      isCompiled: true,
      originalPredicateName: 'Test',
      definition: {
        type: 'IntermediateCompiledPredicateDef',
        name: 'TestFA',
        predicate: 'And',
        inputDefs: ['TestFA', 'b'],
        inputs: [
          {
            type: 'AtomicProposition',
            predicate: { type: 'AtomicPredicate', source: 'Bool' },
            inputs: [{ type: 'NormalInput', inputIndex: 1, children: [] }]
          },
          {
            type: 'AtomicProposition',
            predicate: { type: 'AtomicPredicate', source: 'Bool' },
            inputs: [{ type: 'NormalInput', inputIndex: 1, children: [] }]
          }
        ],
        propertyInputs: []
      }
    },
    {
      type: 'IntermediateCompiledPredicate',
      isCompiled: true,
      originalPredicateName: 'Test',
      definition: {
        type: 'IntermediateCompiledPredicateDef',
        name: 'TestF',
        predicate: 'ForAllSuchThat',
        inputDefs: ['TestF', 'a'],
        inputs: [
          {
            type: 'AtomicProposition',
            predicate: { type: 'AtomicPredicate', source: 'LessThan' },
            inputs: [{ type: 'NormalInput', inputIndex: 1, children: [] }]
          },
          'b',
          {
            type: 'AtomicProposition',
            predicate: { type: 'AtomicPredicate', source: 'TestFA' },
            inputs: [
              { type: 'LabelInput', label: 'TestFA' },
              { type: 'VariableInput', placeholder: 'b', children: [] }
            ]
          }
        ],
        propertyInputs: []
      }
    }
  ]
}
