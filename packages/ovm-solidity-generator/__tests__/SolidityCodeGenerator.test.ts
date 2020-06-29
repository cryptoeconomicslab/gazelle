import { SolidityCodeGenerator } from '../src'
import {
  CompiledPredicate,
  IntermediateCompiledPredicate,
  LogicalConnective,
  CompiledInput,
  AtomicProposition
} from '@cryptoeconomicslab/ovm-transpiler'
import fs from 'fs'
import path from 'path'

const doWrite = false
const testcasePath = '../testcases'
function readFile(filePath: string, output: string) {
  if (doWrite) {
    fs.writeFileSync(path.join(__dirname, testcasePath, filePath), output)
  }
  return fs.readFileSync(path.join(__dirname, testcasePath, filePath))
}

describe('SolidityCodeGenerator', () => {
  const generator = new SolidityCodeGenerator()
  beforeEach(async () => {})

  describe('operator', () => {
    test('and', async () => {
      const input: CompiledPredicate[] = [
        {
          type: 'CompiledPredicate',
          name: 'AndTest',
          inputDefs: [
            { name: 'a', type: 'Bytes' },
            { name: 'b', type: 'Bytes' }
          ],
          contracts: [
            {
              type: 'IntermediateCompiledPredicate',
              originalPredicateName: 'AndTest',
              hasDecideMethod: true,
              name: 'AndTestA',
              connective: LogicalConnective.And,
              inputDefs: ['AndTestA', 'a', 'b'],
              inputs: [
                {
                  type: 'AtomicProposition',
                  predicate: { type: 'AtomicPredicateCall', source: 'Foo' },
                  inputs: [{ type: 'NormalInput', inputIndex: 1, children: [] }]
                },
                {
                  type: 'AtomicProposition',
                  predicate: { type: 'AtomicPredicateCall', source: 'Bar' },
                  inputs: [{ type: 'NormalInput', inputIndex: 2, children: [] }]
                }
              ],
              propertyInputs: []
            }
          ],
          entryPoint: 'AndTestA',
          entryPointOfDecide: 'AndTestA'
        }
      ]
      const output = await generator.generate(input)
      const testOutput = readFile('operators/TestAnd.sol', output)
      expect(output).toBe(testOutput.toString())
    })
    test('or', async () => {
      const input: CompiledPredicate[] = [
        {
          type: 'CompiledPredicate',
          name: 'OrTest',
          inputDefs: [
            { name: 'a', type: 'Bytes' },
            { name: 'b', type: 'Bytes' }
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
                  predicate: { type: 'AtomicPredicateCall', source: 'Foo' },
                  inputs: [{ type: 'NormalInput', inputIndex: 1, children: [] }]
                },
                {
                  type: 'AtomicProposition',
                  predicate: { type: 'AtomicPredicateCall', source: 'Bar' },
                  inputs: [{ type: 'NormalInput', inputIndex: 2, children: [] }]
                }
              ],
              propertyInputs: []
            }
          ],
          entryPoint: 'OrTestO',
          entryPointOfDecide: 'OrTestO'
        }
      ]
      const output = await generator.generate(input)
      const testOutput = readFile('operators/TestOr.sol', output)
      expect(output).toBe(testOutput.toString())
    })
    test('not', async () => {
      const input: CompiledPredicate[] = [
        {
          type: 'CompiledPredicate',
          name: 'NotTest',
          inputDefs: [{ name: 'a', type: 'Bytes' }],
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
                  predicate: { type: 'AtomicPredicateCall', source: 'Foo' },
                  inputs: [{ type: 'NormalInput', inputIndex: 1, children: [] }]
                }
              ],
              propertyInputs: []
            }
          ],
          entryPoint: 'NotTestN'
        }
      ]
      const output = await generator.generate(input)
      const testOutput = readFile('operators/TestNot.sol', output)
      expect(output).toBe(testOutput.toString())
    })
    test('forall', async () => {
      const input: CompiledPredicate[] = [
        {
          type: 'CompiledPredicate',
          name: 'ForallTest',
          inputDefs: [{ name: 'a', type: 'Bytes' }],
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
                  predicate: { type: 'AtomicPredicateCall', source: 'A' },
                  inputs: [{ type: 'NormalInput', inputIndex: 1, children: [] }]
                },
                'b',
                {
                  type: 'AtomicProposition',
                  predicate: { type: 'AtomicPredicateCall', source: 'Foo' },
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
          entryPoint: 'ForallTestF'
        }
      ]
      const output = await generator.generate(input)
      const testOutput = readFile('operators/TestForall.sol', output)
      expect(output).toBe(testOutput.toString())
    })
    test('there', async () => {
      const input: CompiledPredicate[] = [
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
                  predicate: { type: 'AtomicPredicateCall', source: 'Foo' },
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
      ]
      const output = await generator.generate(input)
      const testOutput = readFile('operators/TestThere.sol', output)
      expect(output).toBe(testOutput.toString())
    })
  })

  describe('bind', () => {
    test('bindand', async () => {
      const input: IntermediateCompiledPredicate = {
        type: 'IntermediateCompiledPredicate',
        originalPredicateName: 'BindAndTest',
        name: 'BindAndTestA',
        connective: LogicalConnective.And,
        hasDecideMethod: true,
        inputDefs: ['BindAndTestA', 'a'],
        inputs: [
          {
            type: 'AtomicProposition',
            predicate: { type: 'AtomicPredicateCall', source: 'Foo' },
            inputs: [{ type: 'NormalInput', inputIndex: 1, children: [0] }]
          },
          {
            type: 'AtomicProposition',
            predicate: { type: 'AtomicPredicateCall', source: 'Bar' },
            inputs: [{ type: 'NormalInput', inputIndex: 1, children: [1] }]
          }
        ],
        propertyInputs: [{ type: 'NormalInput', inputIndex: 1, children: [] }]
      }
      const outputOfGetChild = generator.includeCallback('getChild', {
        property: input
      })
      const outputOfDecide = generator.includeCallback('decide', {
        property: input
      })
      const testOutputOfGetChild = readFile(
        'bind/BindAndGetChild.sol',
        outputOfGetChild
      )
      const testOutputOfDecide = readFile(
        'bind/BindAndDecide.sol',
        outputOfDecide
      )
      expect(outputOfGetChild).toBe(testOutputOfGetChild.toString())
      expect(outputOfDecide).toBe(testOutputOfDecide.toString())
    })

    test('bind2', async () => {
      const input: IntermediateCompiledPredicate = {
        type: 'IntermediateCompiledPredicate',
        originalPredicateName: 'Bind2Test',
        name: 'Bind2TestA',
        connective: LogicalConnective.And,
        hasDecideMethod: true,
        inputDefs: ['Bind2TestA', 'a'],
        inputs: [
          {
            type: 'AtomicProposition',
            predicate: { type: 'AtomicPredicateCall', source: 'Foo' },
            inputs: [{ type: 'NormalInput', inputIndex: 1, children: [0] }]
          },
          {
            type: 'AtomicProposition',
            predicate: { type: 'AtomicPredicateCall', source: 'Bar' },
            inputs: [{ type: 'NormalInput', inputIndex: 1, children: [1, 2] }]
          }
        ],
        propertyInputs: [{ type: 'NormalInput', inputIndex: 1, children: [1] }]
      }
      const output = generator.includeCallback('getChild', { property: input })
      const testOutput = readFile('bind/Bind2.sol', output)
      expect(output).toBe(testOutput.toString())
    })

    test('bindval', async () => {
      const input: IntermediateCompiledPredicate = {
        type: 'IntermediateCompiledPredicate',
        originalPredicateName: 'BindValTest',
        name: 'BindValTestT',
        connective: LogicalConnective.ThereExistsSuchThat,
        hasDecideMethod: true,
        inputDefs: ['BindValTestT', 'a'],
        inputs: [
          {
            type: 'AtomicProposition',
            predicate: { type: 'AtomicPredicateCall', source: 'Bytes' },
            inputs: []
          },
          'b',
          {
            type: 'AtomicProposition',
            predicate: { type: 'AtomicPredicateCall', source: 'Foo' },
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
      const output = generator.includeCallback('getChild', { property: input })
      const testOutput = readFile('bind/BindVal.sol', output)
      expect(output).toBe(testOutput.toString())
    })

    test('bindaddr', async () => {
      const input: IntermediateCompiledPredicate = {
        type: 'IntermediateCompiledPredicate',
        originalPredicateName: 'BindAddrTest',
        name: 'BindAddrTestA',
        connective: LogicalConnective.And,
        hasDecideMethod: true,
        inputDefs: ['BindAddrTestA', 'a'],
        inputs: [
          {
            type: 'AtomicProposition',
            predicate: { type: 'AtomicPredicateCall', source: 'Equal' },
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
            predicate: { type: 'AtomicPredicateCall', source: 'Bar' },
            inputs: [{ type: 'NormalInput', inputIndex: 1, children: [0] }]
          }
        ],
        propertyInputs: [{ type: 'NormalInput', inputIndex: 1, children: [] }]
      }
      const output = generator.includeCallback('getChild', { property: input })
      const testOutput = readFile('bind/BindAddr.sol', output)
      expect(output).toBe(testOutput.toString())
    })
  })

  describe('variable', () => {
    test('eval1', async () => {
      const input: IntermediateCompiledPredicate = {
        type: 'IntermediateCompiledPredicate',
        originalPredicateName: 'EvalTest',
        name: 'EvalTestA',
        connective: LogicalConnective.And,
        hasDecideMethod: true,
        inputDefs: ['EvalTestA', 'a', 'b'],
        inputs: [
          {
            type: 'AtomicProposition',
            predicate: { type: 'AtomicPredicateCall', source: 'Foo' },
            inputs: [{ type: 'NormalInput', inputIndex: 1, children: [] }]
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
      const outputOfGetChild = generator.includeCallback('getChild', {
        property: input
      })
      const outputOfDecide = generator.includeCallback('decide', {
        property: input
      })
      const testOutputOfGetChild = readFile(
        'variable/EvalGetChild.sol',
        outputOfGetChild
      )
      const testOutputOfDecide = readFile(
        'variable/EvalDecide.sol',
        outputOfDecide
      )
      expect(outputOfGetChild).toBe(testOutputOfGetChild.toString())
      expect(outputOfDecide).toBe(testOutputOfDecide.toString())
    })
    test('forval', async () => {
      const input: IntermediateCompiledPredicate = {
        type: 'IntermediateCompiledPredicate',
        originalPredicateName: 'ForValTest',
        name: 'ForValTestF',
        connective: LogicalConnective.ForAllSuchThat,
        hasDecideMethod: false,
        inputDefs: ['ForValTestF', 'a'],
        inputs: [
          {
            type: 'AtomicProposition',
            predicate: { type: 'AtomicPredicateCall', source: 'A' },
            inputs: [{ type: 'NormalInput', inputIndex: 1, children: [] }]
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
      const outputOfGetChild = generator.includeCallback('getChild', {
        property: input
      })
      const testOutputOfGetChild = readFile(
        'variable/ForValGetChild.sol',
        outputOfGetChild
      )
      expect(outputOfGetChild).toBe(testOutputOfGetChild.toString())
    })
    test('thereval', async () => {
      const input: IntermediateCompiledPredicate = {
        type: 'IntermediateCompiledPredicate',
        originalPredicateName: 'ThereValTest',
        name: 'ThereValTestT',
        connective: LogicalConnective.ThereExistsSuchThat,
        hasDecideMethod: true,
        inputDefs: ['ThereValTestT'],
        inputs: [
          {
            type: 'AtomicProposition',
            predicate: { type: 'AtomicPredicateCall', source: 'A' },
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
      const outputOfGetChild = generator.includeCallback('getChild', {
        property: input
      })
      const outputOfDecide = generator.includeCallback('decide', {
        property: input
      })
      const testOutputOfGetChild = readFile(
        'variable/ThereValGetChild.sol',
        outputOfGetChild
      )
      const testOutputOfDecide = readFile(
        'variable/ThereValDecide.sol',
        outputOfDecide
      )
      expect(outputOfGetChild).toBe(testOutputOfGetChild.toString())
      expect(outputOfDecide).toBe(testOutputOfDecide.toString())
    })
    test('thereval2', async () => {
      const input: IntermediateCompiledPredicate = {
        type: 'IntermediateCompiledPredicate',
        originalPredicateName: 'ThereValTest',
        name: 'ThereValTestT',
        connective: LogicalConnective.ThereExistsSuchThat,
        hasDecideMethod: true,
        inputDefs: ['ThereValTestT', 'a'],
        inputs: [
          {
            type: 'AtomicProposition',
            predicate: { type: 'AtomicPredicateCall', source: 'B' },
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
      const outputOfGetChild = generator.includeCallback('getChild', {
        property: input
      })
      const outputOfDecide = generator.includeCallback('decide', {
        property: input
      })
      const testOutputOfGetChild = readFile(
        'variable/ThereVal2GetChild.sol',
        outputOfGetChild
      )
      const testOutputOfDecide = readFile(
        'variable/ThereVal2Decide.sol',
        outputOfDecide
      )
      expect(outputOfGetChild).toBe(testOutputOfGetChild.toString())
      expect(outputOfDecide).toBe(testOutputOfDecide.toString())
    })
  })

  describe('constructInput', () => {
    test('ConstantInput', async () => {
      const input: CompiledInput = {
        type: 'ConstantInput',
        name: 'aaa'
      }
      const output = generator.includeCallback('constructInput', {
        input: input,
        valName: 'items',
        index: 0
      })
      expect(output).toBe('        items[0] = aaa;\n')
    })

    test('NormalInput', async () => {
      const input: CompiledInput = {
        type: 'NormalInput',
        inputIndex: 1,
        children: []
      }
      const output = generator.includeCallback('constructInput', {
        input: input,
        valName: 'items',
        index: 1
      })
      expect(output).toBe('        items[1] = _inputs[0];\n')
    })

    test('NormalInput with child', async () => {
      const input: CompiledInput = {
        type: 'NormalInput',
        inputIndex: 0,
        children: [1]
      }
      const output = generator.includeCallback('constructInput', {
        input: input,
        valName: 'items',
        index: 1
      })
      expect(output).toBe('        items[1] = inputProperty0.inputs[1];\n')
    })

    test('NormalInput with child address', async () => {
      const input: CompiledInput = {
        type: 'NormalInput',
        inputIndex: 0,
        children: [-1]
      }
      const output = generator.includeCallback('constructInput', {
        input: input,
        valName: 'items',
        index: 1
      })
      expect(output).toBe(
        '        items[1] = abi.encode(inputProperty0.predicateAddress);\n'
      )
    })

    test('NormalInput with 2 children', async () => {
      const input: CompiledInput = {
        type: 'NormalInput',
        inputIndex: 0,
        children: [1, 2]
      }
      const output = generator.includeCallback('constructInput', {
        input: input,
        valName: 'items',
        index: 1
      })
      expect(output).toBe(
        '        items[1] = inputProperty0Child1.inputs[2];\n'
      )
    })

    test('NormalInput with a child and address', async () => {
      const input: CompiledInput = {
        type: 'NormalInput',
        inputIndex: 0,
        children: [1, -1]
      }
      const output = generator.includeCallback('constructInput', {
        input: input,
        valName: 'items',
        index: 1
      })
      expect(output).toBe(
        '        items[1] = abi.encode(inputProperty0Child1.predicateAddress);\n'
      )
    })

    test('LabelInput', async () => {
      const input: CompiledInput = {
        type: 'LabelInput',
        label: 'FooF'
      }
      const output = generator.includeCallback('constructInput', {
        input: input,
        valName: 'items',
        index: 2
      })
      expect(output).toBe('        items[2] = utils.prefixLabel(FooF);\n')
    })

    test('VariableInput', async () => {
      const input: CompiledInput = {
        type: 'VariableInput',
        placeholder: 'a',
        children: []
      }
      const output = generator.includeCallback('constructInput', {
        input: input,
        valName: 'items',
        index: 3,
        witnessName: 'challengeInput'
      })
      expect(output).toBe('        items[3] = challengeInput;\n')
    })
  })

  describe('decideProperty', () => {
    test('AtomicPredicateCall', async () => {
      const input: AtomicProposition = {
        type: 'AtomicProposition',
        predicate: { type: 'AtomicPredicateCall', source: 'Foo' },
        inputs: []
      }
      const output = generator.includeCallback('decideProperty', {
        property: input,
        valName: 'inputs'
      })
      expect(output).toBe(
        `        bytes[] memory inputs = new bytes[](0);
        require(
            AtomicPredicate(Foo).decide(inputs),
            "Foo must be true"
        );
`
      )
    })

    test('CompiledPredicateCall', async () => {
      const input: AtomicProposition = {
        type: 'AtomicProposition',
        predicate: {
          type: 'CompiledPredicateCall',
          source: 'LibraryPredicate'
        },
        inputs: []
      }
      const output = generator.includeCallback('decideProperty', {
        property: input,
        valName: 'inputs',
        childWitnesses: 'utils.subArray(_witness, 1, _witness.length)'
      })
      expect(output).toBe(
        `        bytes[] memory inputs = new bytes[](0);
        // This is for predicates dynamic linking
        require(
            CompiledPredicate(LibraryPredicate).decide(inputs, utils.subArray(_witness, 1, _witness.length)),
            "LibraryPredicate must be true"
        );
`
      )
    })

    test('InputPredicateCall', async () => {
      const input: AtomicProposition = {
        type: 'AtomicProposition',
        predicate: {
          type: 'InputPredicateCall',
          source: { type: 'NormalInput', inputIndex: 1, children: [] }
        },
        inputs: []
      }
      const output = generator.includeCallback('decideProperty', {
        property: input,
        valName: 'inputs'
      })
      expect(output).toBe(
        `        require(adjudicationContract.isDecidedById(keccak256(_inputs[0])));
`
      )
    })

    test('InputPredicateCall with inputs', async () => {
      const input: AtomicProposition = {
        type: 'AtomicProposition',
        predicate: {
          type: 'InputPredicateCall',
          source: { type: 'NormalInput', inputIndex: 1, children: [] }
        },
        inputs: [
          {
            type: 'NormalInput',
            inputIndex: 1,
            children: []
          }
        ]
      }
      const output = generator.includeCallback('decideProperty', {
        propIndex: '',
        property: input,
        valName: 'inputs',
        childWitnesses: 'utils.subArray(_witness, 1, _witness.length)'
      })
      expect(output).toBe(
        `        types.Property memory inputPredicateProperty = abi.decode(_inputs[0], (types.Property));
        bytes[] memory inputs = new bytes[](inputPredicateProperty.inputs.length + 1);
        for(uint256 i = 0;i < inputPredicateProperty.inputs.length;i++) {
            inputs[i] = inputPredicateProperty.inputs[i];
        }
        inputs[inputPredicateProperty.inputs.length] = _inputs[0];
        require(
            CompiledPredicate(inputPredicateProperty.predicateAddress).decide(inputs, utils.subArray(_witness, 1, _witness.length)),
            "InputPredicate must be true"
        );
`
      )
    })

    test('VariablePredicateCall', async () => {
      const input: AtomicProposition = {
        type: 'AtomicProposition',
        predicate: {
          type: 'VariablePredicateCall'
        },
        inputs: []
      }
      const output = generator.includeCallback('decideProperty', {
        property: input,
        valName: 'inputs'
      })
      expect(output).toBe(
        `        require(
            adjudicationContract.isDecidedById(keccak256(challengeInput)),
            "VariablePredicate must be true"
        );
`
      )
    })
  })

  describe('constructProperty', () => {
    test('AtomicPredicateCall', async () => {
      const input: AtomicProposition = {
        type: 'AtomicProposition',
        predicate: { type: 'AtomicPredicateCall', source: 'Foo' },
        inputs: []
      }
      const output = generator.includeCallback('constructProperty', {
        property: input,
        propIndex: 0,
        valName: 'value',
        freeVariable: 'challengeInput'
      })
      expect(output).toBe(
        `        bytes[] memory childInputsOf0 = new bytes[](0);

        value = abi.encode(types.Property({
            predicateAddress: Foo,
            inputs: childInputsOf0
        }));

`
      )
    })

    test('InputPredicateCall', async () => {
      const input: AtomicProposition = {
        type: 'AtomicProposition',
        predicate: {
          type: 'InputPredicateCall',
          source: { type: 'NormalInput', inputIndex: 1, children: [] }
        },
        inputs: []
      }
      const output = generator.includeCallback('constructProperty', {
        property: input,
        valName: 'inputs'
      })
      expect(output).toBe(
        `        inputs = _inputs[0];
`
      )
    })

    test('InputPredicateCall with inputs', async () => {
      const input: AtomicProposition = {
        type: 'AtomicProposition',
        predicate: {
          type: 'InputPredicateCall',
          source: { type: 'NormalInput', inputIndex: 1, children: [] }
        },
        inputs: [
          {
            type: 'NormalInput',
            inputIndex: 1,
            children: []
          }
        ]
      }
      const output = generator.includeCallback('constructProperty', {
        property: input,
        propIndex: 3,
        valName: 'value',
        freeVariable: 'challengeInput'
      })
      expect(output).toBe(
        `        types.Property memory inputPredicateProperty = abi.decode(_inputs[0], (types.Property));
        bytes[] memory childInputsOf3 = new bytes[](inputPredicateProperty.inputs.length + 1);
        for(uint256 i = 0;i < inputPredicateProperty.inputs.length;i++) {
            childInputsOf3[i] = inputPredicateProperty.inputs[i];
        }
        childInputsOf3[inputPredicateProperty.inputs.length] = _inputs[0];
        value = abi.encode(types.Property({
            predicateAddress: inputPredicateProperty.predicateAddress,
            inputs: childInputsOf3
        }));
`
      )
    })

    test('VariablePredicateCall', async () => {
      const input: AtomicProposition = {
        type: 'AtomicProposition',
        predicate: {
          type: 'VariablePredicateCall'
        },
        inputs: []
      }
      const output = generator.includeCallback('constructProperty', {
        property: input,
        valName: 'inputs'
      })
      expect(output).toBe(
        `        inputs = challengeInputs[0];
`
      )
    })
  })

  describe('getChild', () => {
    test('CompiledPredicateCall', async () => {
      const input: IntermediateCompiledPredicate = {
        type: 'IntermediateCompiledPredicate',
        originalPredicateName: 'CompiledPredicateCallTest',
        name: 'CompiledPredicateCallTestA',
        connective: LogicalConnective.And,
        hasDecideMethod: true,
        inputDefs: ['CompiledPredicateCallTestA', 'a'],
        inputs: [
          {
            type: 'AtomicProposition',
            predicate: {
              type: 'CompiledPredicateCall',
              source: 'CompiledPredicate'
            },
            inputs: []
          },
          {
            type: 'AtomicProposition',
            predicate: { type: 'AtomicPredicateCall', source: 'Foo' },
            inputs: []
          }
        ],
        propertyInputs: []
      }
      const output = generator.includeCallback('getChild', {
        property: input
      })
      expect(output).toBe(
        `    /**
     * Gets child of CompiledPredicateCallTestA(CompiledPredicateCallTestA,a).
     */
    function getChildCompiledPredicateCallTestA(bytes[] memory _inputs, bytes[] memory challengeInputs) private view returns (types.Property memory) {
        uint256 challengeInput = abi.decode(challengeInputs[0], (uint256));
        bytes[] memory notInputs = new bytes[](1);
        if(challengeInput == 0) {
            // This is for predicates dynamic linking
            bytes[] memory childInputs = new bytes[](0);
            return CompiledPredicate(CompiledPredicate).getChild(childInputs, utils.subArray(challengeInputs, 1, challengeInputs.length));
        }
        if(challengeInput == 1) {
            bytes[] memory childInputsOf1 = new bytes[](0);

            notInputs[0] = abi.encode(types.Property({
                predicateAddress: Foo,
                inputs: childInputsOf1
            }));

            return types.Property({
                predicateAddress: notAddress,
                inputs: notInputs
            });
        }
    }
`
      )
    })
  })
})
