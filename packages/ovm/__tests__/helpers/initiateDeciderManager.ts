import {
  DeciderManager,
  AndDecider,
  ForAllSuchThatDecider,
  NotDecider,
  BoolDecider,
  LessThanDecider,
  ThereExistsSuchThatDecider,
  GreaterThanDecider,
  OrDecider,
  IsHashPreimageDecider,
  IsValidSignatureDecider,
  EqualDecider,
  IsLessThanDecider,
  IsSameAmountDecider,
  IsContainedDecider,
  LogicalConnective,
  AtomicPredicate
} from '../../src'
import { Address, Bytes } from '@cryptoeconomicslab/primitives'
import { InMemoryKeyValueStore } from '@cryptoeconomicslab/level-kvs'
import JsonCoder from '@cryptoeconomicslab/coder'
import { setupContext } from '@cryptoeconomicslab/context'
setupContext({ coder: JsonCoder })

export const SampleDeciderAddress = Address.from(
  '0x0000000000000000000000000000000000000001'
)
export const NotDeciderAddress = Address.from(
  '0x0000000000000000000000000000000000000002'
)
export const AndDeciderAddress = Address.from(
  '0x0000000000000000000000000000000000000003'
)
export const ForAllSuchThatDeciderAddress = Address.from(
  '0x0000000000000000000000000000000000000004'
)
export const LessThanQuantifierAddress = Address.from(
  '0x0000000000000000000000000000000000000005'
)
export const LessThanDeciderAddress = Address.from(
  '0x0000000000000000000000000000000000000006'
)
export const GreaterThanDeciderAddress = Address.from(
  '0x0000000000000000000000000000000000000007'
)
export const ThereExistsSuchThatDeciderAddress = Address.from(
  '0x0000000000000000000000000000000000000008'
)
export const OrDeciderAddress = Address.from(
  '0x0000000000000000000000000000000000000009'
)
export const IsHashPreimageDeciderAddress = Address.from(
  '0x0000000000000000000000000000000000000019'
)
export const IsValidSignatureDeciderAddress = Address.from(
  '0x0000000000000000000000000000000000000020'
)
export const EqualDeciderAddress = Address.from(
  '0x0000000000000000000000000000000000000021'
)
export const IsLessThanDeciderAddress = Address.from(
  '0x0000000000000000000000000000000000000022'
)
export const IsSameAmountDeciderAddress = Address.from(
  '0x0000000000000000000000000000000000000023'
)
export const IsContainedDeciderAddress = Address.from(
  '0x0000000000000000000000000000000000000024'
)

export function initializeDeciderManager() {
  const witnessDb = new InMemoryKeyValueStore(Bytes.fromString('test'))
  const deciderManager = new DeciderManager(witnessDb, JsonCoder)
  deciderManager.setDecider(
    SampleDeciderAddress,
    new BoolDecider(),
    AtomicPredicate.Bool
  )
  deciderManager.setDecider(
    NotDeciderAddress,
    new NotDecider(),
    LogicalConnective.Not
  )
  deciderManager.setDecider(
    AndDeciderAddress,
    new AndDecider(),
    LogicalConnective.And
  )
  deciderManager.setDecider(
    OrDeciderAddress,
    new OrDecider(),
    LogicalConnective.Or
  )
  deciderManager.setDecider(
    LessThanDeciderAddress,
    new LessThanDecider(),
    AtomicPredicate.IsLessThan
  )
  deciderManager.setDecider(
    ForAllSuchThatDeciderAddress,
    new ForAllSuchThatDecider(),
    LogicalConnective.ForAllSuchThat
  )
  deciderManager.setDecider(
    GreaterThanDeciderAddress,
    new GreaterThanDecider(),
    AtomicPredicate.GreaterThan
  )
  deciderManager.setDecider(
    ThereExistsSuchThatDeciderAddress,
    new ThereExistsSuchThatDecider(),
    LogicalConnective.ThereExistsSuchThat
  )
  deciderManager.setDecider(
    IsHashPreimageDeciderAddress,
    new IsHashPreimageDecider(),
    AtomicPredicate.IsHashPreimage
  )
  deciderManager.setDecider(
    IsValidSignatureDeciderAddress,
    new IsValidSignatureDecider(),
    AtomicPredicate.IsValidSignature
  )
  deciderManager.setDecider(
    EqualDeciderAddress,
    new EqualDecider(),
    AtomicPredicate.Equal
  )
  deciderManager.setDecider(
    IsLessThanDeciderAddress,
    new IsLessThanDecider(),
    AtomicPredicate.IsLessThan
  )
  deciderManager.setDecider(
    IsSameAmountDeciderAddress,
    new IsSameAmountDecider(),
    AtomicPredicate.IsSameAmount
  )
  deciderManager.setDecider(
    IsContainedDeciderAddress,
    new IsContainedDecider(),
    AtomicPredicate.IsContained
  )

  return deciderManager
}
