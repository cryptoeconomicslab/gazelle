import { Bytes, Address } from '../../types'
import {
  Property,
  convertStringToLogicalConnective,
  convertStringToAtomicPredicate,
  FreeVariable
} from '../types'
import { transpiler } from 'ovm-compiler'
import { DeciderManager } from '../DeciderManager'
import Coder from '../../coder'
import { replaceHint } from '../deciders/getWitnesses'

/**
 * When we have a property below, We can use CompiledPredicate  class to make a property from predicate and concrete inputs.
 * `Test(a) = For all b such that Q(b): Bool(a) and Bool(b)`
 * CompiledPredicate.instantiate(address, name, inputs) creates a property from output of ovm-compiler.
 * We can get an instance of CompiledPredicate with source like
 * ```
 * const compiledPredicate = new CompiledPredicate(source)
 * ```
 * And it can instantiate property using Test.
 * ```
 * // For all b such that Q(b): Bool(10) and Bool(b)
 * compiledPredicate.instantiate('TestF', [10])
 * // Bool(10) and Bool(5)
 * compiledPredicate.instantiate('TestFA', [10, 5])
 * ```
 */
export class CompiledPredicate {
  compiled: transpiler.CompiledPredicate
  manager: DeciderManager
  constructor(compiled: transpiler.CompiledPredicate, manager: DeciderManager) {
    this.compiled = compiled
    this.manager = manager
  }
  instantiate(
    name: string,
    originalAddress: Address,
    inputs: Bytes[]
  ): Property {
    const c = this.compiled.contracts.find(c => c.definition.name == name)
    if (!c) {
      throw new Error(`cannot find ${name} in contracts`)
    }

    const predicateAddress = this.manager.getDeciderAddress(
      convertStringToLogicalConnective(c.definition.predicate)
    )

    return new Property(
      predicateAddress,
      c.definition.inputs.map((i, index) => {
        if (typeof i == 'string') {
          if (
            (c.definition.predicate == 'ForAllSuchThat' ||
              c.definition.predicate == 'ThereExistsSuchThat') &&
            index == 0
          ) {
            i = replaceHint(
              i,
              this.createSubstitutions(c.definition.inputDefs, inputs)
            )
          }
          return Bytes.fromString(i)
        } else if (i.predicate.type == 'AtomicPredicate') {
          let atomicPredicateAddress: Address
          const atomicPredicate = convertStringToAtomicPredicate(
            i.predicate.source
          )
          if (atomicPredicate) {
            atomicPredicateAddress = this.manager.getDeciderAddress(
              atomicPredicate
            )
          } else {
            atomicPredicateAddress = originalAddress
          }
          return Coder.encode(
            this.createChildProperty(
              atomicPredicateAddress,
              i,
              inputs
            ).toStruct()
          )
        } else {
          throw new Error('predicate must be atomic or string')
        }
      })
    )
  }

  /**
   * createProperty
   * @param atomicPredicateAddress
   * @param proposition
   * @param inputs
   */
  private createChildProperty(
    atomicPredicateAddress: Address,
    proposition: transpiler.AtomicProposition,
    inputs: Bytes[]
  ): Property {
    return new Property(
      atomicPredicateAddress,
      proposition.inputs.map(i => {
        if (i.type == 'NormalInput') {
          return inputs[i.inputIndex]
        } else if (i.type == 'VariableInput') {
          return FreeVariable.from(i.placeholder)
        } else if (i.type == 'LabelInput') {
          return Bytes.fromString(i.label)
        } else {
          throw new Error(`${i} has unknow type`)
        }
      })
    )
  }

  private createSubstitutions(
    inputDefs: string[],
    inputs: Bytes[]
  ): { [key: string]: Bytes } {
    const result: { [key: string]: Bytes } = {}
    if (inputDefs.length != inputs.length) {
      throw new Error('The length of inputDefs and inputs must be same.')
    }
    inputDefs.forEach((def, index) => {
      result[def] = inputs[index]
    })
    return result
  }
}
