import { Bytes, Address } from '../../types/Codables'
import { Decider } from '../interfaces/Decider'
import { Decision, Property } from '../types'
import { DeciderManager } from '../DeciderManager'
import { CompiledPredicate } from './CompiledPredicate'

export class CompiledDecider implements Decider {
  constructor(
    private originalAddress: Address,
    private predicateSource: CompiledPredicate,
    readonly constantTable: { [key: string]: Bytes } = {}
  ) {}
  public async decide(
    manager: DeciderManager,
    inputs: Bytes[],
    substitutions: { [key: string]: Bytes } = {}
  ): Promise<Decision> {
    const property = this.predicateSource.instantiate(
      new Property(this.originalAddress, inputs),
      manager.predicateAddressTable,
      this.constantTable
    )
    return manager.decide(property, substitutions)
  }
}
