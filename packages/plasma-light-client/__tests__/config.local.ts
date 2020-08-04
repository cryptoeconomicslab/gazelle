export default {
  logicalConnectiveAddressTable: {
    Not: '0x9FBDa871d559710256a2502A2517b794B482Db40',
    And: '0x2C2B9C9a4a25e24B174f26114e8926a9f2128FE4',
    Or: '0x0000000000000000000000000000000000000001',
    ForAllSuchThat: '0x30753E4A8aad7F8597332E813735Def5dD395028',
    ThereExistsSuchThat: '0x0000000000000000000000000000000000000002'
  },
  atomicPredicateAddressTable: {
    IsValidSignature: '0xFB88dE099e13c3ED21F80a7a1E49f8CAEcF10df6',
    IsContained: '0xAa588d3737B611baFD7bD713445b314BD453a5C8',
    IsLessThan: '0xd5dd64faaf8af5ff95b30d727e2b832b7964c16e',
    Equal: '0xea1ca2f6e17b158f5b8c3a00e54a8f0e0f8f04bf',
    VerifyInclusion: '0xfa088b2aaf4839d738d5a3d436021c6ad424269a',
    IsSameAmount: '0xc8fd3b9399f47610f27d6b604749276865085937'
  },
  deployedPredicateTable: {
    StateUpdatePredicate: {
      deployedAddress: '0x82D50AD3C1091866E258Fd0f1a7cC9674609D254',
      source: [
        {
          type: 'CompiledPredicate',
          name: 'StateUpdate',
          inputDefs: [
            { name: 'token', type: 'Address' },
            { name: 'range', type: 'Range' },
            { name: 'block_number', type: 'BigNumber' },
            { name: 'so', type: 'Property' }
          ],
          contracts: [
            {
              type: 'IntermediateCompiledPredicate',
              originalPredicateName: 'StateUpdate',
              name: 'StateUpdateTA1A',
              connective: 'And',
              inputDefs: [
                'StateUpdateTA1A',
                'tx',
                'token',
                'range',
                'block_number'
              ],
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
                    { type: 'ConstantInput', name: 'txAddress' }
                  ]
                },
                {
                  type: 'AtomicProposition',
                  predicate: {
                    type: 'AtomicPredicateCall',
                    source: 'Equal'
                  },
                  inputs: [
                    { type: 'NormalInput', inputIndex: 1, children: [0] },
                    { type: 'NormalInput', inputIndex: 2, children: [] }
                  ]
                },
                {
                  type: 'AtomicProposition',
                  predicate: {
                    type: 'AtomicPredicateCall',
                    source: 'IsContained'
                  },
                  inputs: [
                    { type: 'NormalInput', inputIndex: 3, children: [] },
                    { type: 'NormalInput', inputIndex: 1, children: [1] }
                  ]
                },
                {
                  type: 'AtomicProposition',
                  predicate: {
                    type: 'AtomicPredicateCall',
                    source: 'IsLessThan'
                  },
                  inputs: [
                    { type: 'NormalInput', inputIndex: 4, children: [] },
                    { type: 'NormalInput', inputIndex: 1, children: [2] }
                  ]
                }
              ],
              propertyInputs: [
                { type: 'NormalInput', inputIndex: 1, children: [] }
              ]
            },
            {
              type: 'IntermediateCompiledPredicate',
              originalPredicateName: 'StateUpdate',
              name: 'StateUpdateTA',
              connective: 'And',
              inputDefs: [
                'StateUpdateTA',
                'tx',
                'token',
                'range',
                'block_number',
                'so'
              ],
              inputs: [
                {
                  type: 'AtomicProposition',
                  predicate: {
                    type: 'AtomicPredicateCall',
                    source: 'StateUpdateTA1A'
                  },
                  inputs: [
                    { type: 'LabelInput', label: 'StateUpdateTA1A' },
                    { type: 'NormalInput', inputIndex: 1, children: [] },
                    { type: 'NormalInput', inputIndex: 2, children: [] },
                    { type: 'NormalInput', inputIndex: 3, children: [] },
                    { type: 'NormalInput', inputIndex: 4, children: [] }
                  ],
                  isCompiled: true
                },
                {
                  type: 'AtomicProposition',
                  predicate: {
                    type: 'InputPredicateCall',
                    source: {
                      type: 'NormalInput',
                      inputIndex: 5,
                      children: []
                    }
                  },
                  inputs: [{ type: 'NormalInput', inputIndex: 1, children: [] }]
                }
              ],
              propertyInputs: []
            },
            {
              type: 'IntermediateCompiledPredicate',
              originalPredicateName: 'StateUpdate',
              name: 'StateUpdateT',
              connective: 'ThereExistsSuchThat',
              inputDefs: [
                'StateUpdateT',
                'token',
                'range',
                'block_number',
                'so'
              ],
              inputs: [
                'tx.block${block_number}.range${token},RANGE,${range}',
                'tx',
                {
                  type: 'AtomicProposition',
                  predicate: {
                    type: 'AtomicPredicateCall',
                    source: 'StateUpdateTA'
                  },
                  inputs: [
                    { type: 'LabelInput', label: 'StateUpdateTA' },
                    {
                      type: 'VariableInput',
                      placeholder: 'tx',
                      children: []
                    },
                    { type: 'NormalInput', inputIndex: 1, children: [] },
                    { type: 'NormalInput', inputIndex: 2, children: [] },
                    { type: 'NormalInput', inputIndex: 3, children: [] },
                    { type: 'NormalInput', inputIndex: 4, children: [] }
                  ],
                  isCompiled: true
                }
              ],
              propertyInputs: []
            }
          ],
          entryPoint: 'StateUpdateT',
          constants: [{ varType: 'bytes', name: 'txAddress' }]
        }
      ]
    },
    OwnershipPredicate: {
      deployedAddress: '0xeec918d74c746167564401103096D45BbD494B74',
      source: [
        {
          type: 'CompiledPredicate',
          name: 'Ownership',
          inputDefs: [
            { name: 'owner', type: 'Address' },
            { name: 'tx', type: 'Property' }
          ],
          contracts: [
            {
              type: 'IntermediateCompiledPredicate',
              originalPredicateName: 'Ownership',
              name: 'OwnershipT',
              connective: 'ThereExistsSuchThat',
              inputDefs: ['OwnershipT', 'owner', 'tx'],
              inputs: [
                'signatures,KEY,${tx}',
                'v0',
                {
                  type: 'AtomicProposition',
                  predicate: {
                    type: 'AtomicPredicateCall',
                    source: 'IsValidSignature'
                  },
                  inputs: [
                    { type: 'NormalInput', inputIndex: 2, children: [] },
                    {
                      type: 'VariableInput',
                      placeholder: 'v0',
                      children: []
                    },
                    { type: 'NormalInput', inputIndex: 1, children: [] },
                    { type: 'ConstantInput', name: 'secp256k1' }
                  ]
                }
              ],
              propertyInputs: []
            }
          ],
          entryPoint: 'OwnershipT',
          constants: [{ varType: 'bytes', name: 'secp256k1' }]
        }
      ]
    },
    CheckpointPredicate: {
      deployedAddress: '0xEcFcaB0A285d3380E488A39B4BB21e777f8A4EaC',
      source: [
        {
          type: 'CompiledPredicate',
          name: 'Checkpoint',
          inputDefs: [{ name: 'su', type: 'Property' }],
          contracts: [
            {
              type: 'IntermediateCompiledPredicate',
              originalPredicateName: 'Checkpoint',
              name: 'CheckpointFO1N',
              connective: 'Not',
              inputDefs: ['CheckpointFO1N', 'b', 'su'],
              inputs: [
                {
                  type: 'AtomicProposition',
                  predicate: {
                    type: 'AtomicPredicateCall',
                    source: 'IsLessThan'
                  },
                  inputs: [
                    { type: 'NormalInput', inputIndex: 1, children: [] },
                    { type: 'NormalInput', inputIndex: 2, children: [2] }
                  ]
                }
              ],
              propertyInputs: [
                { type: 'NormalInput', inputIndex: 2, children: [] }
              ]
            },
            {
              type: 'IntermediateCompiledPredicate',
              originalPredicateName: 'Checkpoint',
              name: 'CheckpointFO2FO1N1T',
              connective: 'ThereExistsSuchThat',
              inputDefs: ['CheckpointFO2FO1N1T', 'old_su', 'su', 'b'],
              inputs: [
                'proof.block${b}.range${token},RANGE,${range}',
                'v0',
                {
                  type: 'AtomicProposition',
                  predicate: {
                    type: 'AtomicPredicateCall',
                    source: 'VerifyInclusion'
                  },
                  inputs: [
                    { type: 'NormalInput', inputIndex: 1, children: [] },
                    { type: 'NormalInput', inputIndex: 2, children: [0] },
                    { type: 'NormalInput', inputIndex: 2, children: [1] },
                    {
                      type: 'VariableInput',
                      placeholder: 'v0',
                      children: []
                    },
                    { type: 'NormalInput', inputIndex: 3, children: [] }
                  ]
                }
              ],
              propertyInputs: [
                { type: 'NormalInput', inputIndex: 2, children: [] }
              ]
            },
            {
              type: 'IntermediateCompiledPredicate',
              originalPredicateName: 'Checkpoint',
              name: 'CheckpointFO2FO1N',
              connective: 'Not',
              inputDefs: ['CheckpointFO2FO1N', 'old_su', 'su', 'b'],
              inputs: [
                {
                  type: 'AtomicProposition',
                  predicate: {
                    type: 'AtomicPredicateCall',
                    source: 'CheckpointFO2FO1N1T'
                  },
                  inputs: [
                    { type: 'LabelInput', label: 'CheckpointFO2FO1N1T' },
                    { type: 'NormalInput', inputIndex: 1, children: [] },
                    { type: 'NormalInput', inputIndex: 2, children: [] },
                    { type: 'NormalInput', inputIndex: 3, children: [] }
                  ],
                  isCompiled: true
                }
              ],
              propertyInputs: []
            },
            {
              type: 'IntermediateCompiledPredicate',
              originalPredicateName: 'Checkpoint',
              name: 'CheckpointFO2FO',
              connective: 'Or',
              inputDefs: ['CheckpointFO2FO', 'old_su', 'su', 'b'],
              inputs: [
                {
                  type: 'AtomicProposition',
                  predicate: {
                    type: 'AtomicPredicateCall',
                    source: 'CheckpointFO2FO1N'
                  },
                  inputs: [
                    { type: 'LabelInput', label: 'CheckpointFO2FO1N' },
                    { type: 'NormalInput', inputIndex: 1, children: [] },
                    { type: 'NormalInput', inputIndex: 2, children: [] },
                    { type: 'NormalInput', inputIndex: 3, children: [] }
                  ],
                  isCompiled: true
                },
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
                  inputs: []
                }
              ],
              propertyInputs: []
            },
            {
              type: 'IntermediateCompiledPredicate',
              originalPredicateName: 'Checkpoint',
              name: 'CheckpointFO2F',
              connective: 'ForAllSuchThat',
              inputDefs: ['CheckpointFO2F', 'su', 'b'],
              inputs: [
                'so.block${b}.range${su.0},RANGE,${su.1}',
                'old_su',
                {
                  type: 'AtomicProposition',
                  predicate: {
                    type: 'AtomicPredicateCall',
                    source: 'CheckpointFO2FO'
                  },
                  inputs: [
                    { type: 'LabelInput', label: 'CheckpointFO2FO' },
                    {
                      type: 'VariableInput',
                      placeholder: 'old_su',
                      children: []
                    },
                    { type: 'NormalInput', inputIndex: 1, children: [] },
                    { type: 'NormalInput', inputIndex: 2, children: [] }
                  ],
                  isCompiled: true
                }
              ],
              propertyInputs: []
            },
            {
              type: 'IntermediateCompiledPredicate',
              originalPredicateName: 'Checkpoint',
              name: 'CheckpointFO',
              connective: 'Or',
              inputDefs: ['CheckpointFO', 'b', 'su'],
              inputs: [
                {
                  type: 'AtomicProposition',
                  predicate: {
                    type: 'AtomicPredicateCall',
                    source: 'CheckpointFO1N'
                  },
                  inputs: [
                    { type: 'LabelInput', label: 'CheckpointFO1N' },
                    { type: 'NormalInput', inputIndex: 1, children: [] },
                    { type: 'NormalInput', inputIndex: 2, children: [] }
                  ],
                  isCompiled: true
                },
                {
                  type: 'AtomicProposition',
                  predicate: {
                    type: 'AtomicPredicateCall',
                    source: 'CheckpointFO2F'
                  },
                  inputs: [
                    { type: 'LabelInput', label: 'CheckpointFO2F' },
                    { type: 'NormalInput', inputIndex: 2, children: [] },
                    { type: 'NormalInput', inputIndex: 1, children: [] }
                  ],
                  isCompiled: true
                }
              ],
              propertyInputs: []
            },
            {
              type: 'IntermediateCompiledPredicate',
              originalPredicateName: 'Checkpoint',
              name: 'CheckpointF',
              connective: 'ForAllSuchThat',
              inputDefs: ['CheckpointF', 'su'],
              inputs: [
                'range,NUMBER,0x0000000000000000000000000000000000000000000000000000000000000000-${su.2}',
                'b',
                {
                  type: 'AtomicProposition',
                  predicate: {
                    type: 'AtomicPredicateCall',
                    source: 'CheckpointFO'
                  },
                  inputs: [
                    { type: 'LabelInput', label: 'CheckpointFO' },
                    {
                      type: 'VariableInput',
                      placeholder: 'b',
                      children: []
                    },
                    { type: 'NormalInput', inputIndex: 1, children: [] }
                  ],
                  isCompiled: true
                }
              ],
              propertyInputs: []
            }
          ],
          entryPoint: 'CheckpointF'
        }
      ]
    },
    ExitPredicate: {
      deployedAddress: '0x4E72770760c011647D4873f60A3CF6cDeA896CD8',
      source: [
        {
          type: 'CompiledPredicate',
          name: 'Exit',
          inputDefs: [
            { name: 'su', type: 'Property' },
            { name: 'proof', type: 'Bytes' }
          ],
          contracts: [
            {
              type: 'IntermediateCompiledPredicate',
              originalPredicateName: 'Exit',
              name: 'ExitA2N',
              connective: 'Not',
              inputDefs: ['ExitA2N', 'su'],
              inputs: [
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
                  inputs: []
                }
              ],
              propertyInputs: []
            },
            {
              type: 'IntermediateCompiledPredicate',
              originalPredicateName: 'Exit',
              name: 'ExitA',
              connective: 'And',
              inputDefs: ['ExitA', 'su', 'proof'],
              inputs: [
                {
                  type: 'AtomicProposition',
                  predicate: {
                    type: 'AtomicPredicateCall',
                    source: 'VerifyInclusion'
                  },
                  inputs: [
                    { type: 'NormalInput', inputIndex: 1, children: [] },
                    { type: 'NormalInput', inputIndex: 1, children: [0] },
                    { type: 'NormalInput', inputIndex: 1, children: [1] },
                    { type: 'NormalInput', inputIndex: 2, children: [] },
                    { type: 'NormalInput', inputIndex: 1, children: [2] }
                  ]
                },
                {
                  type: 'AtomicProposition',
                  predicate: {
                    type: 'AtomicPredicateCall',
                    source: 'ExitA2N'
                  },
                  inputs: [
                    { type: 'LabelInput', label: 'ExitA2N' },
                    { type: 'NormalInput', inputIndex: 1, children: [] }
                  ],
                  isCompiled: true
                },
                {
                  type: 'AtomicProposition',
                  predicate: {
                    type: 'AtomicPredicateCall',
                    source: 'Checkpoint'
                  },
                  inputs: [{ type: 'NormalInput', inputIndex: 1, children: [] }]
                }
              ],
              propertyInputs: [
                { type: 'NormalInput', inputIndex: 1, children: [] }
              ]
            }
          ],
          entryPoint: 'ExitA',
          constants: [{ varType: 'address', name: 'Checkpoint' }]
        }
      ]
    },
    ExitDepositPredicate: {
      deployedAddress: '0xA4392264a2d8c998901D10C154C91725b1BF0158',
      source: [
        {
          type: 'CompiledPredicate',
          name: 'ExitDeposit',
          inputDefs: [
            { name: 'su', type: 'Property' },
            { name: 'checkpoint', type: 'Property' }
          ],
          contracts: [
            {
              type: 'IntermediateCompiledPredicate',
              originalPredicateName: 'ExitDeposit',
              name: 'ExitDepositN',
              connective: 'Not',
              inputDefs: ['ExitDepositN', 'su', 'checkpoint'],
              inputs: [
                {
                  type: 'AtomicProposition',
                  predicate: {
                    type: 'InputPredicateCall',
                    source: { type: 'NormalInput', inputIndex: 1, children: [] }
                  },
                  inputs: []
                }
              ],
              propertyInputs: []
            }
          ],
          entryPoint: 'ExitDepositN'
        }
      ]
    }
  },
  constantVariableTable: {
    secp256k1: '0x736563703235366b31',
    txAddress:
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    commitmentContract:
      '0x000000000000000000000000f12b5dd4ead5f743c6baa640b0216200e89b60da'
  },
  commitment: '0x8CdaF0CD259887258Bc13a92C0a6dA92698644C0',
  disputeManager: '0xB529f14AA8096f943177c09Ca294Ad66d2E08b1f',
  checkpointDispute: '0x3d49d1eF2adE060a33c6E6Aa213513A7EE9a6241',
  exitDispute: '0x2a504B5e7eC284ACa5b6f49716611237239F0b97',
  adjudicationContract: '0x8f0483125FCb9aaAEFA9209D8E9d7b9C8B9Fb90F',
  payoutContracts: {
    DepositContract: '0xA4392264a2d8c998901D10C154C91725b1BF0158',
    OwnershipPayout: '0xf204a4Ef082f5c04bB89F7D5E6568B796096735a'
  },
  PlasmaETH: '0x13274Fe19C0178208bCbee397af8167A7be27f6f'
}
