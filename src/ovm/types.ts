import { Address, Bytes, List, Struct } from '../types/Codables'

export interface Challenge {
  property: Property
  challengeInput: Bytes | null
}

export interface Decision {
  outcome: boolean
  challenges: Challenge[]
}

export class Property {
  public deciderAddress: Address
  public inputs: Bytes[]

  constructor(deciderAddress: Address, inputs: Bytes[]) {
    this.deciderAddress = deciderAddress
    this.inputs = inputs
  }
  public toStruct(): Struct {
    return new Struct({
      deciderAddress: this.deciderAddress,
      inputs: new List(Bytes, this.inputs)
    })
  }
  public static getParamType(): Struct {
    return Struct.from({
      deciderAddress: Address.default(),
      inputs: List.default(Bytes, Bytes.default())
    })
  }
  public static fromStruct(_struct: Struct): Property {
    return new Property(
      _struct.data['deciderAddress'] as Address,
      (_struct.data['inputs'] as List<Bytes>).data
    )
  }
}

const VARIABLE_PREFIX = '__VARIABLE__'
const VARIABLE_PREFIX_REGEX = /__VARIABLE__(.*)/
/**
 * Free variable for property to handle quantifier.
 * free variable is a Bytes whose string representation starts from prefix __VARIABLE__.
 */
export class FreeVariable {
  /**
   * return variable name string if input bytes is well formed free variable
   * otherwise return null
   * @param input input bytes
   */
  static getVariableName(input: Bytes): string | null {
    const s = input.intoString()
    const result = VARIABLE_PREFIX_REGEX.exec(s)
    if (result) {
      return result[1] || null
    }
    return null
  }

  static from(name: string): Bytes {
    return Bytes.fromString(`${VARIABLE_PREFIX}${name}`)
  }
}

export enum LogicalConnective {
  And = 'And',
  ForAllSuchThat = 'ForAllSuchThat',
  Not = 'Not',
  Or = 'Or',
  ThereExistsSuchThat = 'ThereExistsSuchThat'
}

export enum AtomicPredicate {
  IsValidPreimage = 'IsValidPreimage',
  IsValidSignature = 'IsValidSignature',
  VerifyInclusion = 'VerifyInclusion',
  IsLessThan = 'IsLessThan',
  Equal = 'Equal',
  Bool = 'Bool',
  LessThanQuantifier = 'LessThanQuantifier',
  IsSameAmount = 'IsSameAmount',
  IsContained = 'IsContained'
}

export type LogicalConnectiveStrings = keyof typeof LogicalConnective
export type AtomicPredicateStrings = keyof typeof AtomicPredicate

export function convertStringToLogicalConnective(
  name: LogicalConnectiveStrings
): LogicalConnective {
  return LogicalConnective[name]
}

export function convertStringToAtomicPredicate(
  name: AtomicPredicateStrings
): AtomicPredicate {
  return AtomicPredicate[name]
}
