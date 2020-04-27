import { Bytes } from '@cryptoeconomicslab/primitives'
import { Decider } from '../interfaces/Decider'
import { Decision, Property } from '../types'
import { DeciderManager } from '../DeciderManager'
import { CompiledPredicate } from './CompiledPredicate'

export class CompiledDecider implements Decider {
  constructor(
    private predicateSource: CompiledPredicate,
    readonly constantTable: { [key: string]: Bytes } = {}
  ) {}
  public async decide(
    manager: DeciderManager,
    inputs: Bytes[],
    substitutions: { [key: string]: Bytes } = {}
  ): Promise<Decision> {
    const property = this.predicateSource.decompileProperty(
      new Property(this.predicateSource.deployedAddress, inputs),
      manager.shortnameMap,
      this.constantTable
    )
    return manager.decide(property, substitutions)
  }

  public decompile(manager: DeciderManager, inputs: Bytes[]) {
    return this.predicateSource.decompileProperty(
      new Property(this.predicateSource.deployedAddress, inputs),
      manager.shortnameMap,
      this.constantTable
    )
  }
}
