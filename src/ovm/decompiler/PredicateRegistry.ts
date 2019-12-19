import { CompiledPredicate } from './CompiledPredicate'
import { CompiledDecider } from './CompiledDecider'
import { Address, Bytes } from '../../types'
import { DeciderManager } from '../DeciderManager'

export class PredicateRegistry {
  static registerDecider(
    deciderManager: DeciderManager,
    address: Address,
    source: string,
    constantVariableTable: { [key: string]: Bytes }
  ): CompiledDecider {
    const predicate = CompiledPredicate.fromSource(source)
    const decider = new CompiledDecider(
      address,
      predicate,
      constantVariableTable
    )
    deciderManager.setDecider(address, decider)
    return decider
  }
}
