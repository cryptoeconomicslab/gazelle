import { Bytes, Address } from '../../types'
import { Property, FreeVariable } from '../types'
import * as parser from 'ovm-compiler/dist/parser'
import * as transpiler from 'ovm-compiler/dist/transpiler'
import Coder from '../../coder'
import { replaceHint } from '../deciders/getWitnesses'
import { decodeStructable } from '../../utils/DecoderUtil'
import {
  NormalInput,
  AtomicProposition,
  LogicalConnective
} from 'ovm-compiler/dist/transpiler'

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
  // compiled property
  compiled: transpiler.CompiledPredicate
  // original source code of property
  source: string | null = null

  constructor(
    readonly deployedAddress: Address,
    compiled: transpiler.CompiledPredicate,
    source?: string
  ) {
    this.compiled = compiled
    this.deployedAddress = deployedAddress
    if (source) {
      this.source = source
    }
  }

  static fromSource(
    deployedAddress: Address,
    source: string
  ): CompiledPredicate {
    const propertyParser = new parser.Parser()
    return new CompiledPredicate(
      deployedAddress,
      transpiler.transpilePropertyDefsToCompiledPredicate(
        propertyParser.parse(source)
      )[0],
      source
    )
  }

  getPredicateName(): string {
    return this.compiled.name
  }

  makeProperty(inputs: Bytes[]): Property {
    return new Property(this.deployedAddress, inputs)
  }

  /**
   * makeProperty instantiates decompiled property from compiled property
   * @param compiledProperty
   * @param predicateTable
   * @param constantTable
   */
  decompileProperty(
    compiledProperty: Property,
    predicateTable: Map<string, Address>,
    constantTable: { [key: string]: Bytes } = {}
  ): Property {
    const name: string = compiledProperty.inputs[0].intoString()
    const originalAddress: Address = compiledProperty.deciderAddress
    const findContract = (name: string) => {
      return this.compiled.contracts.find(c => c.name == name)
    }

    let c = findContract(name)
    if (!c) {
      // If contract is not found, use entry point.
      c = findContract(this.compiled.entryPoint)
      compiledProperty.inputs.unshift(
        Bytes.fromString(this.compiled.entryPoint)
      )
    }
    if (c === undefined) {
      throw new Error(`cannot find ${name} in contracts`)
    }
    const def = c
    const originalPredicateName = c.originalPredicateName
    const predicateAddress = predicateTable.get(c.connective)

    if (predicateAddress === undefined) {
      throw new Error(`predicateAddress ${def.connective} not found`)
    }

    const createInput = (input: AtomicProposition) => {
      if (input.predicate.type == 'AtomicPredicateCall') {
        // If the predicate name is not listed in AtomicPredicate enum, it's compiled predicate.
        let atomicPredicateAddress: Address | undefined
        if (input.predicate.source.indexOf(originalPredicateName) == 0) {
          // If input.predicate.source is "${originalPredicateName}TA2O"
          atomicPredicateAddress = originalAddress
        } else {
          atomicPredicateAddress = predicateTable.get(input.predicate.source)
        }
        if (atomicPredicateAddress === undefined) {
          throw new Error(`The address of ${input.predicate.source} not found.`)
        }
        return Coder.encode(
          this.createChildProperty(
            atomicPredicateAddress,
            input,
            compiledProperty.inputs,
            originalAddress,
            constantTable
          ).toStruct()
        )
      } else if (input.predicate.type == 'InputPredicateCall') {
        const property = decodeStructable(
          Property,
          Coder,
          compiledProperty.inputs[input.predicate.source.inputIndex]
        )
        const extraInputBytes = input.inputs.map(
          i => compiledProperty.inputs[(i as NormalInput).inputIndex]
        )
        property.inputs = property.inputs.concat(extraInputBytes)
        return Coder.encode(property.toStruct())
      } else if (input.predicate.type == 'VariablePredicateCall') {
        // When predicateDef has VariablePredicate, inputs[1] must be variable name
        return FreeVariable.from(def.inputs[1] as string)
      } else {
        throw new Error('predicate must be atomic, input or variable.')
      }
    }

    if (
      def.connective == LogicalConnective.ForAllSuchThat ||
      def.connective == LogicalConnective.ThereExistsSuchThat
    ) {
      return new Property(predicateAddress, [
        Bytes.fromString(
          replaceHint(
            def.inputs[0] as string,
            this.createSubstitutions(def.inputDefs, compiledProperty.inputs)
          )
        ),
        Bytes.fromString(def.inputs[1] as string),
        createInput(def.inputs[2] as AtomicProposition)
      ])
    } else {
      // In case of And, Or, Not and other predicates
      return new Property(
        predicateAddress,
        def.inputs.map(i => createInput(i as AtomicProposition))
      )
    }
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
    inputs: Bytes[],
    selfAddress: Address,
    constantsTable: { [key: string]: Bytes }
  ): Property {
    return new Property(
      atomicPredicateAddress,
      proposition.inputs.map(i => {
        if (i.type == 'NormalInput') {
          return this.constructInput(inputs[i.inputIndex], i.children)
        } else if (i.type == 'VariableInput') {
          return FreeVariable.from(i.placeholder)
        } else if (i.type == 'LabelInput') {
          return Bytes.fromString(i.label)
        } else if (i.type == 'ConstantInput') {
          const constVar = constantsTable[i.name]
          if (constVar === undefined) {
            throw new Error(`constant value ${i.name} not found.`)
          }
          return constantsTable[i.name]
        } else if (i.type == 'SelfInput') {
          return Bytes.fromHexString(selfAddress.data)
        } else {
          throw new Error(`${i} has unknow type`)
        }
      })
    )
  }

  private constructInput(anInput: Bytes, children: number[]): Bytes {
    if (children.length == 0) {
      return anInput
    }
    const property = decodeStructable(Property, Coder, anInput)
    if (children[0] == -1) {
      return Bytes.fromHexString(property.deciderAddress.data)
    } else {
      return this.constructInput(
        property.inputs[children[0]],
        children.slice(1)
      )
    }
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
