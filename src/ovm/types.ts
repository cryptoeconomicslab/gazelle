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
  Within = 'Within',
  Bool = 'Bool',
  LessThanQuantifier = 'LessThanQuantifier',
  IsSameAmount = 'IsSameAmount',
  IsContained = 'IsContained'
}

export function convertStringToLogicalConnective(
  name: string
): LogicalConnective {
  if (name == 'And') {
    return LogicalConnective.And
  } else if (name == 'Or') {
    return LogicalConnective.Or
  } else if (name == 'ForAllSuchThat') {
    return LogicalConnective.ForAllSuchThat
  } else if (name == 'ThereExistsSuchThat') {
    return LogicalConnective.ThereExistsSuchThat
  } else if (name == 'Not') {
    return LogicalConnective.Not
  } else {
    throw new Error('invalid logical connective name')
  }
}

export function convertStringToAtomicPredicate(
  name: string
): AtomicPredicate | null {
  if (name == 'IsLessThan') {
    return AtomicPredicate.IsLessThan
  } else if (name == 'LessThan') {
    return AtomicPredicate.LessThanQuantifier
  } else if (name == 'IsValidPreimage') {
    return AtomicPredicate.IsValidPreimage
  } else if (name == 'IsValidSignature') {
    return AtomicPredicate.IsValidSignature
  } else if (name == 'VerifyInclusion') {
    return AtomicPredicate.VerifyInclusion
  } else if (name == 'Equal') {
    return AtomicPredicate.Equal
  } else if (name == 'Within') {
    return AtomicPredicate.Within
  } else if (name == 'Bool') {
    return AtomicPredicate.Bool
  } else if (name == 'IsSameAmount') {
    return AtomicPredicate.IsSameAmount
  } else if (name == 'IsContained') {
    return AtomicPredicate.IsContained
  } else {
    return null
    // throw new Error('invalid atomic predicate name')
  }
}
