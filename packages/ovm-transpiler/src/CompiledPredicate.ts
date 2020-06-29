import { ArgDef } from '@cryptoeconomicslab/ovm-parser'

/**
 * Compiled Property definition
 */
export interface CompiledPredicate {
  type: 'CompiledPredicate'
  name: string
  inputDefs: ArgDef[]
  contracts: IntermediateCompiledPredicate[]
  constants?: ConstantVariable[]
  entryPoint: string
  entryPointOfDecide?: string
}

export interface ConstantVariable {
  varType: 'address' | 'bytes'
  name: string
}

/**
 * IntermediateCompiledPredicate is core of compilation which has only atomic propositions as its inputs.
 * When we have for a in B() {Foo(a) and Bar(a)},
 * "for a in B() {...}" and "Foo(a) and Bar(a)" are IntermediateCompiledPredicate.
 */
export interface IntermediateCompiledPredicate {
  type: 'IntermediateCompiledPredicate'
  name: string
  originalPredicateName: string
  // logical connective
  connective: LogicalConnective | LogicalConnectiveStrings
  inputDefs: string[]
  inputs: (AtomicProposition | Placeholder)[]
  propertyInputs: NormalInput[]
  // This IntermediateCompiledPredicate has decide method or not
  hasDecideMethod?: boolean
}

export interface AtomicProposition {
  type: 'AtomicProposition'
  predicate: PredicateCall
  inputs: CompiledInput[]
  isCompiled?: boolean
}

export type Placeholder = string

export type PredicateCall =
  | AtomicPredicateCall
  | InputPredicateCall
  | VariablePredicateCall
  | CompiledPredicateCall

/**
 * e.g. IsValidSignature()
 */
export interface AtomicPredicateCall {
  type: 'AtomicPredicateCall'
  source: string
}

/**
 * e.g. a() of "def Foo(a) := a()"
 */
export interface InputPredicateCall {
  type: 'InputPredicateCall'
  source: NormalInput
}

/**
 * e.g. su() of "def Foo(a) := with SU(a) as su {su()}"
 */
export interface VariablePredicateCall {
  type: 'VariablePredicateCall'
}

/**
 * For predicates dynamic linking
 * e.g. Confsig() user defined predicate
 */
export interface CompiledPredicateCall {
  type: 'CompiledPredicateCall'
  source: string
}

/**
 * CompiledInput indicates which value to pass to PredicateCall as input of predicate
 * For example, parentProperty.inputs[0].inputs[1] is NormalInput and inputIndex is 0 and children is [1].
 */
export type CompiledInput =
  | ConstantInput
  | LabelInput
  | NormalInput
  | VariableInput
  | SelfInput

export interface ConstantInput {
  type: 'ConstantInput'
  name: string
}

export interface LabelInput {
  type: 'LabelInput'
  label: string
}

export interface NormalInput {
  type: 'NormalInput'
  inputIndex: number
  children: number[]
}

export interface VariableInput {
  type: 'VariableInput'
  placeholder: string
  children: number[]
}

export interface SelfInput {
  type: 'SelfInput'
  children: number[]
}

// LogicalConnective
export enum LogicalConnective {
  And = 'And',
  ForAllSuchThat = 'ForAllSuchThat',
  Not = 'Not',
  Or = 'Or',
  ThereExistsSuchThat = 'ThereExistsSuchThat'
}

export type LogicalConnectiveStrings = keyof typeof LogicalConnective

export function convertStringToLogicalConnective(
  name: LogicalConnectiveStrings
): LogicalConnective {
  return LogicalConnective[name]
}
