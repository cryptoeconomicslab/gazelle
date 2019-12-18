import { Bytes, Address } from '../../types'
import {
  Property,
  convertStringToLogicalConnective as toLogicalConnective,
  convertStringToAtomicPredicate,
  FreeVariable
} from '../types'
import { parser, transpiler } from 'ovm-compiler'
import Coder from '../../coder'
import { replaceHint } from '../deciders/getWitnesses'
import { LogicalConnective, AtomicPredicate } from '../types'

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
 * const propertyTestF = new Property(TestPredicateAddress, ['TestF', 10])
 * compiledPredicate.instantiate(propertyTestF)
 * // Bool(10) and Bool(5)
 * const propertyTestFA = new Property(TestPredicateAddress, ['TestFA', 10, 5])
 * compiledPredicate.instantiate(propertyTestFA)
 * ```
 */
export class CompiledPredicate {
  compiled: transpiler.CompiledPredicate

  constructor(compiled: transpiler.CompiledPredicate) {
    this.compiled = compiled
  }

  static fromSource(source: string): CompiledPredicate {
    const propertyParser = new parser.Parser()
    return new CompiledPredicate(
      transpiler.transpilePropertyDefsToCompiledPredicate(
        propertyParser.parse(source)
      )[0]
    )
  }

  instantiate(
    compiledProperty: Property,
    predicateTable: Map<LogicalConnective | AtomicPredicate, Address>
  ): Property {
    const name: string = compiledProperty.inputs[0].intoString()
    const originalAddress: Address = compiledProperty.deciderAddress

    const c = this.compiled.contracts.find(c => c.definition.name == name)
    if (!c) {
      throw new Error(`cannot find ${name} in contracts`)
    }

    const logicalConnective = toLogicalConnective(c.definition.predicate)
    const predicateAddress = predicateTable.get(logicalConnective)

    if (predicateAddress === undefined) {
      throw new Error(`predicateAddress ${c.definition.predicate} not found`)
    }

    return new Property(
      predicateAddress,
      c.definition.inputs.map((i, index) => {
        if (typeof i == 'string') {
          if (
            (logicalConnective == LogicalConnective.ForAllSuchThat ||
              logicalConnective == LogicalConnective.ThereExistsSuchThat) &&
            index == 0
          ) {
            i = replaceHint(
              i,
              this.createSubstitutions(
                c.definition.inputDefs,
                compiledProperty.inputs
              )
            )
          }
          return Bytes.fromString(i)
        } else if (i.predicate.type == 'AtomicPredicate') {
          let atomicPredicateAddress: Address | undefined
          const atomicPredicate = convertStringToAtomicPredicate(
            i.predicate.source
          )
          if (atomicPredicate) {
            atomicPredicateAddress = predicateTable.get(atomicPredicate)
            if (predicateAddress === undefined) {
              throw new Error(
                `predicateAddress ${c.definition.predicate} not found`
              )
            }
          } else {
            atomicPredicateAddress = originalAddress
          }
          if (atomicPredicateAddress === undefined) {
            throw new Error(
              `predicateAddress ${atomicPredicateAddress} not found`
            )
          }
          return Coder.encode(
            this.createChildProperty(
              atomicPredicateAddress,
              i,
              compiledProperty.inputs
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
