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
import { LogicalConnective, AtomicPredicate } from './types'
import { Address, Bytes } from '../types/Codables'
import { Decider } from './interfaces/Decider'
import { CompiledPredicate, CompiledDecider } from './decompiler'

export function initializeDeciders(
  deciderManager: DeciderManager,
  predicateAddressTable: {
    [key: string]: Address
  }
) {
  const registerDecider = (
    predicateName: AtomicPredicate | LogicalConnective,
    decider: Decider
  ) => {
    deciderManager.setDecider(
      predicateAddressTable[predicateName],
      decider,
      predicateName
    )
  }
  registerDecider(LogicalConnective.And, new AndDecider())
  registerDecider(LogicalConnective.Or, new OrDecider())
  registerDecider(LogicalConnective.Not, new NotDecider())
  registerDecider(LogicalConnective.ForAllSuchThat, new ForAllSuchThatDecider())
  registerDecider(
    LogicalConnective.ThereExistsSuchThat,
    new ThereExistsSuchThatDecider()
  )
  registerDecider(AtomicPredicate.Bool, new SampleDecider())
  registerDecider(AtomicPredicate.IsContained, new IsContainedDecider())
  registerDecider(AtomicPredicate.Equal, new EqualDecider())
  registerDecider(AtomicPredicate.IsLessThan, new IsLessThanDecider())
  registerDecider(
    AtomicPredicate.IsValidSignature,
    new IsValidSignatureDecider()
  )
  registerDecider(AtomicPredicate.IsSameAmount, new IsSameAmountDecider())
  registerDecider(AtomicPredicate.IsValidPreimage, new IsHashPreimageDecider())
}

export function initializeCompiledPredicates(
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
    deciderManager.setDecider(deployedPredicateInfo.deployedAddress, decider)
  }
  deployedPredicateTable.forEach(registerPredicate)
}
