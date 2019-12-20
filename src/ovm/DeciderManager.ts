import { Address, Bytes } from '../../src/types/Codables'
import { Decider } from './interfaces/Decider'
import { Property, Decision, FreeVariable, AtomicPredicate } from './types'
import { Quantifier } from './interfaces/Quantifier'
import { KeyValueStore } from '../db'

export interface DeciderManagerInterface {
  decide(
    property: Property,
    substitutions?: { [key: string]: Bytes }
  ): Promise<Decision>
  getDeciderAddress(shortname: string): Address
}

/**
 * DeciderManager manages deciders and its address
 */
export class DeciderManager implements DeciderManagerInterface {
  private deciders: Map<string, Decider>
  private shortnames: Map<string, Address>
  private quantifiers: Map<string, Quantifier>
  public witnessDb: KeyValueStore
  constructor(witnessDb: KeyValueStore) {
    this.witnessDb = witnessDb
    this.deciders = new Map<string, Decider>()
    this.shortnames = new Map<string, Address>()
    this.quantifiers = new Map<string, Quantifier>()
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

  public get predicateAddressTable(): Map<string, Address> {
    return this.shortnames
  }

  /**
   * Sets quantifier with address
   * @param address
   * @param quantifier
   */
  public setQuantifier(
    address: Address,
    quantifier: Quantifier,
    operator?: AtomicPredicate
  ) {
    this.quantifiers.set(address.data, quantifier)
    if (operator !== undefined) {
      this.shortnames.set(operator, address)
    }
  }
  /**
   * Gets quantifier with address
   * @param address
   */
  public getQuantifier(address: Address): Quantifier | null {
    const quantifier = this.quantifiers.get(address.data)
    if (quantifier) {
      return quantifier
    } else {
      return null
    }
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
      return await decider.decide(
        this,
        bindVariables(property.inputs, substitutions),
        substitutions
      )
    } else {
      throw new Error('Decider not found')
    }
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
