import { Bytes, Address } from '../../types/Codables'
import { Decider } from '../interfaces/Decider'
import { Decision, Property } from '../types'
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
    const property = this.predicateSource.decompileProperty(
      new Property(this.originalAddress, inputs),
      manager.shortnameMap
    )
    return manager.decide(property, substitutions)
  }
}
