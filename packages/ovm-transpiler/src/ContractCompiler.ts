import * as utils from './utils'
import {
  CompiledInput,
  CompiledPredicate,
  IntermediateCompiledPredicate,
  AtomicProposition,
  Placeholder,
  PredicateCall,
  NormalInput,
  ConstantVariable,
  convertStringToLogicalConnective,
  LogicalConnectiveStrings
} from './CompiledPredicate'
import {
  ArgDef,
  PropertyDef,
  PropertyNode
} from '@cryptoeconomicslab/ovm-parser'

/**
 * @name createCompiledPredicates
 * @description transpile PropertyDefs to CompilePredicates
 * @param {*} propertyDefs are definition of claim
 */
export function createCompiledPredicates(
  propertyDefs: PropertyDef[]
): CompiledPredicate[] {
  return propertyDefs.map(createCompiledPredicatesForProperty)
}

function createCompiledPredicatesForProperty(
  p: PropertyDef
): CompiledPredicate {
  const name = utils.toCapitalCase(p.name)
  if (p.body == null) {
    throw new Error('p.body must not be null')
  }
  const newContracts: IntermediateCompiledPredicate[] = traverseLogicalConnnective(
    p.body,
    p.inputDefs.map(def => def.name),
    name
  )
  const constants = getConstants(newContracts)
  const result: CompiledPredicate = {
    type: 'CompiledPredicate',
    name,
    inputDefs: p.inputDefs,
    contracts: newContracts,
    entryPoint: newContracts[newContracts.length - 1].name,
    entryPointOfDecide: getEntryPointOfDecide(newContracts)
  }
  if (constants.length > 0) {
    result.constants = constants
  }
  return result
}

function getEntryPointOfDecide(newContracts: IntermediateCompiledPredicate[]) {
  for (let i = newContracts.length - 1; i >= 0; i--) {
    if (newContracts[i].hasDecideMethod) {
      return newContracts[i].name
    }
  }
}

/**
 * @name traverseLogicalConnnective
 * @description traverse logical connectives and returns CompiledPredicates
 * @param {*} property
 * @param {*} parent
 * @param {*} originalPredicateName
 * @param {*} parentSuffix
 */
function traverseLogicalConnnective(
  property: PropertyNode,
  parentInputDefs: string[],
  originalPredicateName: string,
  parentSuffix?: string
): IntermediateCompiledPredicate[] {
  if (!utils.isNotAtomicProposition(property.predicate)) {
    return []
  }
  const suffix = (parentSuffix || '') + property.predicate[0]
  let newInputDefs = getArguments(property)
  if (parentSuffix === undefined) {
    newInputDefs = parentInputDefs
  }
  newInputDefs = [makeContractName(originalPredicateName, suffix)].concat(
    newInputDefs
  )
  let hasDecideMethod = true
  if (property.predicate === 'ForAllSuchThat' || property.predicate === 'Not') {
    // can't decide ForAllSuchThat or Not with witness
    hasDecideMethod = false
  }
  const children: (AtomicProposition | Placeholder)[] = []
  const compiledPredicates = property.inputs.reduce<
    IntermediateCompiledPredicate[]
  >((acc, p: PropertyNode | string | undefined, i: number) => {
    if (p && typeof p !== 'string') {
      let childSuffix = suffix
      if (
        property.predicate === 'And' ||
        property.predicate === 'Or' ||
        property.predicate === 'Not'
      ) {
        childSuffix += i + 1
      }
      const contracts = traverseLogicalConnnective(
        p,
        newInputDefs,
        originalPredicateName,
        childSuffix
      )
      children.push(
        createAtomicProposition(
          contracts[contracts.length - 1],
          p as PropertyNode,
          newInputDefs
        )
      )
      return contracts.concat(acc)
    } else {
      if (p) children.push(p)
      return acc
    }
  }, [])
  const newContract = createCompiledPredicate(
    property,
    newInputDefs,
    originalPredicateName,
    suffix,
    hasDecideMethod && compiledPredicates.every(c => c.hasDecideMethod)
  )
  newContract.inputs = children
  newContract.propertyInputs = getPropertyInputIndexes(children)
  return compiledPredicates.concat([newContract])
}

function createCompiledPredicate(
  property: PropertyNode,
  newInputDefs: string[],
  originalPredicateName: string,
  suffix: string,
  hasDecideMethod: boolean
): IntermediateCompiledPredicate {
  return {
    type: 'IntermediateCompiledPredicate',
    originalPredicateName,
    name: makeContractName(originalPredicateName, suffix),
    connective: convertStringToLogicalConnective(
      property.predicate as LogicalConnectiveStrings
    ),
    inputDefs: newInputDefs,
    inputs: [],
    propertyInputs: [],
    hasDecideMethod
  }
}

function createAtomicProposition(
  newContract: IntermediateCompiledPredicate,
  property: PropertyNode,
  parentInputDefs: string[]
) {
  if (utils.isNotAtomicProposition(property.predicate)) {
    return compileLogicalConnective(
      newContract,
      parentInputDefs,
      newContract.inputDefs
    )
  } else {
    return compileAtomicPredicate(property, parentInputDefs)
  }
}

function compileLogicalConnective(
  newContract: IntermediateCompiledPredicate,
  parentInputDefs: string[],
  newInputDefs: string[]
): AtomicProposition {
  return {
    type: 'AtomicProposition',
    predicate: {
      type: 'AtomicPredicateCall',
      source: newContract.name
    },
    inputs: getInputIndex(parentInputDefs, newInputDefs, true),
    isCompiled: true
  }
}

function compileAtomicPredicate(
  property: PropertyNode,
  parentInputDefs: string[]
): AtomicProposition {
  return {
    type: 'AtomicProposition',
    predicate: getPredicate(parentInputDefs, property.predicate),
    inputs: getInputIndex(parentInputDefs, property.inputs as string[])
  }
}

function getPredicate(inputDefs: string[], name: string): PredicateCall {
  const inputIndex = inputDefs.indexOf(name)
  if (inputIndex >= 0) {
    return {
      type: 'InputPredicateCall',
      source: {
        type: 'NormalInput',
        inputIndex: inputIndex,
        children: []
      }
    }
  } else if (utils.isUpperCase(name[0])) {
    if (utils.isCompiledPredicate(name)) {
      // This is for calling user defined predicate dybamically
      return {
        type: 'CompiledPredicateCall',
        source: name
      }
    } else {
      return {
        type: 'AtomicPredicateCall',
        source: name
      }
    }
  } else {
    return {
      type: 'VariablePredicateCall'
    }
  }
}

function getPropertyInputIndexes(
  children: (AtomicProposition | Placeholder)[]
): NormalInput[] {
  const allInputs = children.reduce((acc: CompiledInput[], c) => {
    if (typeof c != 'string') {
      return acc.concat(c.inputs)
    }
    return acc
  }, [])
  const result: NormalInput[] = []
  allInputs.forEach(input => {
    if (input.type == 'NormalInput') {
      if (input.children.length >= 1) {
        if (!result[input.inputIndex]) {
          result[input.inputIndex] = {
            type: 'NormalInput',
            inputIndex: input.inputIndex,
            children: []
          }
        }
        if (input.children.length == 2) {
          result[input.inputIndex].children.push(input.children[0])
        }
      }
    }
  })
  return result.filter(r => !!r)
}

function getInputIndex(
  inputDefs: string[],
  inputs: string[],
  isFirstInputLabel = false
): CompiledInput[] {
  return inputs.map((name, index) => {
    if (name.indexOf('.') > 0) {
      // in case of that name is bind operator
      const parentAndChildren = utils.getBindParams(name)
      const inputIndex = inputDefs.indexOf(parentAndChildren.parent)
      if (inputIndex >= 0) {
        return {
          type: 'NormalInput',
          inputIndex,
          children: parentAndChildren.children
        }
      } else {
        if (utils.isReservedWord(parentAndChildren.parent)) {
          return {
            type: 'SelfInput',
            children: parentAndChildren.children
          }
        } else {
          return {
            type: 'VariableInput',
            placeholder: parentAndChildren.parent,
            children: parentAndChildren.children
          }
        }
      }
    } else {
      const inputIndex = inputDefs.indexOf(name)
      if (inputIndex >= 0) {
        return {
          type: 'NormalInput',
          inputIndex,
          children: []
        }
      }
    }
    if (utils.isConstantVariable(name)) {
      return {
        type: 'ConstantInput',
        name: name.substr(1)
      }
    } else if (isFirstInputLabel && index == 0) {
      return {
        type: 'LabelInput',
        label: name
      }
    } else {
      return {
        type: 'VariableInput',
        placeholder: name,
        children: []
      }
    }
  })
}

function getArguments(property: PropertyNode): string[] {
  let args: string[] = []
  if (
    property.predicate == 'ForAllSuchThat' ||
    property.predicate == 'ThereExistsSuchThat'
  ) {
    if (typeof property.inputs[0] !== 'string') {
      // If inputs[0] is not hint string
      args = args.concat(getArguments(property.inputs[0] as PropertyNode))
    }
    const variable = property.inputs[1] as string
    const innerArgs = getArguments(property.inputs[2] as PropertyNode)
    args = args.concat(innerArgs.filter(a => a != variable))
  } else {
    if (!utils.isUpperCase(property.predicate[0])) {
      args.push(property.predicate)
    }
    property.inputs.forEach((p: PropertyNode | string | undefined) => {
      if (p === undefined) {
        return
      }
      if (typeof p === 'string') {
        const getValName = (p: string) => {
          if (p.indexOf('.') > 0) {
            return p.substr(0, p.indexOf('.'))
          } else {
            return p
          }
        }
        const valName = getValName(p)
        // bind operator
        if (
          !utils.isReservedWord(valName) &&
          !utils.isConstantVariable(valName)
        ) {
          args.push(valName)
        }
      } else if (p.type == 'PropertyNode') {
        args = args.concat(getArguments(p))
      }
    })
  }
  return args.filter(function(x, i, self) {
    return self.indexOf(x) === i
  })
}

function makeContractName(name: string, suffix: string) {
  return utils.toCapitalCase(name) + suffix
}

function getConstants(
  predicates: IntermediateCompiledPredicate[]
): ConstantVariable[] {
  const results: ConstantVariable[] = []
  predicates.forEach(p => {
    p.inputs.forEach(i => {
      if (typeof i != 'string' && i.type == 'AtomicProposition') {
        if (i.predicate.type == 'CompiledPredicateCall' && !i.isCompiled) {
          const predicateName = i.predicate.source
          if (
            utils.isCompiledPredicate(predicateName) &&
            !results.find(r => r.name == predicateName)
          ) {
            results.push({
              varType: 'address',
              name: predicateName
            })
          }
        }
        i.inputs.forEach(i => {
          if (
            i.type == 'ConstantInput' &&
            !results.find(r => r.name == i.name)
          ) {
            results.push({
              varType: 'bytes',
              name: i.name
            })
          }
        })
      }
    })
  })
  return results
}
