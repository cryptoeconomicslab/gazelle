import { CompiledPredicate } from './CompiledPredicate'
import { CompiledDecider } from './CompiledDecider'
import { Address } from '../../types'
import { DeciderManager } from '../DeciderManager'

export class PredicateRegistry {
  static registerDecider(
    deciderManager: DeciderManager,
    address: Address,
    source: string
  ): CompiledDecider {
    const predicate = CompiledPredicate.fromSource(source)
    const decider = new CompiledDecider(address, predicate)
    deciderManager.setDecider(address, decider)
    return decider
  }
}
