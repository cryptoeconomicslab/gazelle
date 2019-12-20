import { DeciderManager } from './DeciderManager'
import {
  AndDecider,
  ForAllSuchThatDecider,
  NotDecider,
  SampleDecider,
  ThereExistsSuchThatDecider,
  OrDecider,
  IsHashPreimageDecider,
  IsValidSignatureDecider,
  EqualDecider,
  IsLessThanDecider,
  IsSameAmountDecider,
  IsContainedDecider
} from './deciders'
import {
  LogicalConnective,
  LogicalConnectiveStrings,
  AtomicPredicate,
  AtomicPredicateStrings,
  convertStringToLogicalConnective,
  convertStringToAtomicPredicate
} from './types'
import { Address, Bytes } from '../types/Codables'
import { Decider } from './interfaces/Decider'
import { CompiledPredicate, CompiledDecider } from './decompiler'

const deciders: { [key: string]: Decider } = {
  And: new AndDecider(),
  Or: new OrDecider(),
  Not: new NotDecider(),
  ForAllSuchThat: new ForAllSuchThatDecider(),
  ThereExistsSuchThat: new ThereExistsSuchThatDecider(),
  Bool: new SampleDecider(),
  IsContained: new IsContainedDecider(),
  Equal: new EqualDecider(),
  IsLessThan: new IsLessThanDecider(),
  IsValidSignature: new IsValidSignatureDecider(),
  IsSameAmount: new IsSameAmountDecider(),
  IsValidPreimage: new IsLessThanDecider()
}

export interface InitilizationConfig {
  logicalConnectiveAddressTable: {
    [key: string]: Address
  }
  atomicPredicateAddressTable: {
    [key: string]: Address
  }
  deployedPredicateTable: { deployedAddress: Address; source: string }[]
  constantVariableTable: { [key: string]: Bytes }
}

export function initialize(
  deciderManager: DeciderManager,
  config: InitilizationConfig
) {
  initializeDeciders(
    deciderManager,
    config.logicalConnectiveAddressTable,
    config.atomicPredicateAddressTable
  )
  initializeCompiledPredicates(
    deciderManager,
    config.deployedPredicateTable,
    config.constantVariableTable
  )
}

function initializeDeciders(
  deciderManager: DeciderManager,
  logicalConnectiveAddressTable: {
    [key: string]: Address
  },
  atomicPredicateAddressTable: {
    [key: string]: Address
  }
) {
  const registerDecider = (
    predicateName: AtomicPredicate | LogicalConnective,
    deployedAddress: Address,
    decider: Decider
  ) => {
    deciderManager.setDecider(deployedAddress, decider, predicateName)
  }
  for (const name in logicalConnectiveAddressTable) {
    registerDecider(
      convertStringToLogicalConnective(name as LogicalConnectiveStrings),
      logicalConnectiveAddressTable[name],
      deciders[name]
    )
  }
  for (const name in atomicPredicateAddressTable) {
    registerDecider(
      convertStringToAtomicPredicate(name as AtomicPredicateStrings),
      atomicPredicateAddressTable[name],
      deciders[name]
    )
  }
}

function initializeCompiledPredicates(
  deciderManager: DeciderManager,
  deployedPredicateTable: { deployedAddress: Address; source: string }[],
  constantVariableTable: { [key: string]: Bytes }
) {
  const registerPredicate = (deployedPredicateInfo: {
    deployedAddress: Address
    source: string
  }) => {
    const predicate = CompiledPredicate.fromSource(
      deployedPredicateInfo.deployedAddress,
      deployedPredicateInfo.source
    )
    const decider = new CompiledDecider(predicate, constantVariableTable)
    deciderManager.setDecider(
      deployedPredicateInfo.deployedAddress,
      decider,
      predicate.getPredicateName()
    )
  }
  deployedPredicateTable.forEach(registerPredicate)
}
