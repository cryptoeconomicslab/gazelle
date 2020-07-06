import { DeciderConfig } from '../../src'

const config: DeciderConfig = {
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
    OwnershipPredicate: {
      deployedAddress: '0x13274fe19c0178208bcbee397af8167a7be27f6f',
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
                    { type: 'ConstantInput', name: 'verifierType' }
                  ]
                }
              ],
              propertyInputs: []
            }
          ],
          entryPoint: 'OwnershipT',
          constants: [{ varType: 'bytes', name: 'verifierType' }]
        }
      ]
    }
  },
  constantVariableTable: {
    verifierType: '0x747970656444617461',
    txAddress:
      '0x0000000000000000000000000000000000000000000000000000000000000000'
  }
}
export default config
