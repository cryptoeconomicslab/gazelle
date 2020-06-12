import { Address, Bytes } from '@cryptoeconomicslab/primitives'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import JsonCoder, { Coder } from '@cryptoeconomicslab/coder'
import { Decider } from './interfaces/Decider'
import { Property, Decision, FreeVariable } from './types'
import { initialize, DeciderConfig } from './load'
import { CompiledPredicate, CompiledDecider } from './decompiler'
import { TraceInfoCreator } from './Tracer'

export interface DeciderManagerInterface {
  readonly coder: Coder
  decide(
    property: Property,
    substitutions?: { [key: string]: Bytes }
  ): Promise<Decision>
  getDeciderAddress(shortname: string): Address
  getStorageDb(): Promise<KeyValueStore>
  isDecompiledProperty(property: Property): boolean
  decompile(property: Property): Property | null
}

/**
 * DeciderManager manages deciders and its address
 */
export class DeciderManager implements DeciderManagerInterface {
  private deciders: Map<string, Decider>
  private shortnames: Map<string, Address>
  private compiledPredicates: Map<string, CompiledPredicate>
  public witnessDb: KeyValueStore
  constructor(witnessDb: KeyValueStore, readonly coder: Coder = JsonCoder) {
    this.witnessDb = witnessDb
    this.deciders = new Map<string, Decider>()
    this.shortnames = new Map<string, Address>()
    this.compiledPredicates = new Map<string, CompiledPredicate>()
  }

  /**
   * restore hint for `∀t: ¬p(t)`
   * @param property a property which has empty hint string
   * @returns restored property
   */
  private restoreHint(property: Property): Property {
    if (
      property.deciderAddress !== this.getDeciderAddress('ForAllSuchThat') ||
      !property.inputs[0].equals(Bytes.default())
    ) {
      return property
    }
    const notProperty = Property.fromStruct(
      ovmContext.coder.decode(Property.getParamType(), property.inputs[2])
    )
    const innerProperty = Property.fromStruct(
      ovmContext.coder.decode(Property.getParamType(), notProperty.inputs[0])
    )
    const decider = this.getDecider(innerProperty.deciderAddress)
    if (decider && decider instanceof CompiledDecider) {
      const hint = decider.restoreHint(innerProperty.inputs)
      return new Property(
        property.deciderAddress,
        [hint].concat(property.inputs.slice(1))
      )
    } else {
      throw new Error('decider not found')
    }
  }

  /**
   * load JSON file to initialize DeciderManager
   * @param config
   */
  loadJson(config: DeciderConfig) {
    initialize(this, config)
  }

  /**
   * Sets new decider with address
   * @param address
   * @param decier
   */
  public setDecider(address: Address, decier: Decider, shortname?: string) {
    this.deciders.set(address.raw, decier)
    if (shortname) {
      this.shortnames.set(shortname, address)
    }
  }
  /**
   * Gets decider with address
   * @param address
   */
  public getDecider(address: Address): Decider | null {
    const decider = this.deciders.get(address.raw)
    if (decider) {
      return decider
    } else {
      return null
    }
  }
  /**
   * Gets address of a decider with operator name
   * @param operator
   */
  public getDeciderAddress(shortname: string): Address {
    const address = this.shortnames.get(shortname)
    if (address) {
      return address
    } else {
      throw new Error("initialization isn't done")
    }
  }

  public get shortnameMap(): ReadonlyMap<string, Address> {
    return this.shortnames
  }

  public get compiledPredicateMap(): ReadonlyMap<string, CompiledPredicate> {
    return this.compiledPredicates
  }

  public setCompiledPredicate(
    predicateName: string,
    compiledPredicate: CompiledPredicate
  ) {
    this.compiledPredicates.set(predicateName, compiledPredicate)
  }

  public async getStorageDb(): Promise<KeyValueStore> {
    const bucket = await this.witnessDb.bucket(Bytes.fromString('storage'))
    return bucket
  }

  /**
   * Decides property is true or false and returns decision structure.
   * @param property
   * @param substitutions Substitution rule of key value pair for free variables
   */
  public async decide(
    property: Property,
    substitutions: { [key: string]: Bytes } = {}
  ): Promise<Decision> {
    const decider = this.getDecider(property.deciderAddress)
    if (decider) {
      const inputs = bindVariables(
        this.restoreHint(property).inputs,
        substitutions
      )
      const decision = await decider.decide(this, inputs, substitutions)
      if (decision.outcome === false && decision.traceInfo === undefined) {
        // Set debug info for atomic predicates
        decision.traceInfo = TraceInfoCreator.create(
          decider.constructor.name,
          inputs
        )
      }
      return decision
    } else {
      throw new Error(
        'Decider not found: ' + property.deciderAddress.toString()
      )
    }
  }

  public isDecompiledProperty(property: Property): boolean {
    return this.decompile(property) !== null
  }

  public decompile(property: Property): Property | null {
    const decider = this.getDecider(property.deciderAddress)
    if (decider instanceof CompiledDecider) {
      return decider.decompile(this, property.inputs)
    }
    return null
  }
}

export const bindVariables = (
  inputs: Bytes[],
  substitutions: { [key: string]: Bytes }
): Bytes[] => {
  return inputs.map(input => {
    const key = FreeVariable.getVariableName(input)
    if (key && substitutions[key]) {
      return substitutions[key]
    }
    return input
  })
}
