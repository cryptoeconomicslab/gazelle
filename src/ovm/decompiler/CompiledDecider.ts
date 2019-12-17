import { Bytes, Address } from '../../types/Codables'
import { Decider } from '../interfaces/Decider'
import { Decision } from '../types'
import { DeciderManager } from '../DeciderManager'
import { CompiledPredicate } from './CompiledPredicate'

export class CompiledDecider implements Decider {
  constructor(
    private originalAddress: Address,
    private predicateSource: CompiledPredicate
  ) {}
  public async decide(
    manager: DeciderManager,
    inputs: Bytes[],
    substitutions: { [key: string]: Bytes } = {}
  ): Promise<Decision> {
    const property = this.predicateSource.instantiate(
      inputs[0].intoString(),
      this.originalAddress,
      inputs,
      manager.predicateAddressTable
    )
    return manager.decide(property, substitutions)
  }
}
