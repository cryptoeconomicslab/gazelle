import ejs from 'ejs'
import path from 'path'
import templateSource from './sol'
import decide from './decide'
import getChild from './getChild'
import constructProperty from './constructProperty'
import constructInputs from './constructInputs'
import constructInput from './constructInput'
import decideProperty from './decideProperty'
import { CodeGenerator } from '@cryptoeconomicslab/ovm-generator'
import {
  CompiledPredicate,
  IntermediateCompiledPredicate,
  LogicalConnective,
  AtomicProposition,
  AtomicPredicateCall
} from '@cryptoeconomicslab/ovm-transpiler'
import { ArgDef } from '@cryptoeconomicslab/ovm-parser'

const templates: { [key: string]: string } = {
  decide: decide.toString(),
  getChild: getChild.toString(),
  constructProperty: constructProperty.toString(),
  constructInputs: constructInputs.toString(),
  constructInput: constructInput.toString(),
  decideProperty: decideProperty.toString()
}

export interface SolidityCodeGeneratorOptions {
  addressTable: { [key: string]: string }
  ovmPath?: string
}

const defaultOVMPath = 'ovm-contracts'

/**
 * @name SolidityCodeGenerator
 * @description A code generator for Solidity language
 */
export class SolidityCodeGenerator implements CodeGenerator {
  constructor(
    readonly options: SolidityCodeGeneratorOptions = {
      addressTable: {},
      ovmPath: defaultOVMPath
    }
  ) {}
  async generate(compiledPredicates: CompiledPredicate[]): Promise<string> {
    const template = ejs.compile(templateSource.toString(), { client: true })
    const output = template(
      {
        compiledPredicates,
        ...this.getHelpers()
      },
      undefined,
      this.includeCallback
    )
    return output
  }

  includeCallback = (filename: string, d: any) => {
    const template = ejs.compile(templates[filename], {
      client: true
    })
    return template(
      { ...this.getHelpers(), ...d },
      undefined,
      this.includeCallback
    )
  }

  getOVMPath = () => {
    return path.normalize(this.options.ovmPath || defaultOVMPath)
  }
  getAddress = (predicateName: string) => {
    return (
      this.options.addressTable[predicateName] ||
      '0x0000000000000000000000000000000000000000'
    )
  }

  /**
   * @name indent
   * @description make indent
   */
  indent = (text: string, depth: number) => {
    return text
      .split('\n')
      .map(function(line, num) {
        if (line) {
          for (let i = 0; i < depth; i++) {
            line = ' ' + line
          }
        }
        return line
      })
      .join('\n')
  }

  /**
   * isNotCompiledPredicate method check providing atomicProposition is the CompiledPredicate which has Not logical connective.
   * @returns return true if atomicProposition is CompiledPredicate which has not connective, otherwise return false.
   */
  isNotCompiledPredicate = (
    atomicProposition: AtomicProposition,
    predicates: IntermediateCompiledPredicate[]
  ): boolean => {
    const predicateName = (atomicProposition.predicate as AtomicPredicateCall)
      .source
    const innerPredicate = predicates.find(p => p.name === predicateName)
    return (
      !!innerPredicate && innerPredicate.connective === LogicalConnective.Not
    )
  }

  getTypeString = (type: string, isDeclare = false): string => {
    const map = {
      Address: 'address',
      Bytes: 'bytes' + (isDeclare ? ' memory' : ''),
      BigNumber: 'uint256'
    }
    return map[type]
  }

  generateTypes = (inputDefs: ArgDef[]): string[] => {
    return inputDefs.map(
      inputDef => `"${this.getTypeString(inputDef.type)} ${inputDef.name}"`
    )
  }

  generateValueNames = (inputDefs: ArgDef[]): string[] => {
    return inputDefs.map(inputDef => inputDef.name)
  }

  getHelpers = () => {
    return {
      getAddress: this.getAddress,
      indent: this.indent,
      getOVMPath: this.getOVMPath,
      isNotCompiledPredicate: this.isNotCompiledPredicate,
      generateTypes: this.generateTypes,
      generateValueNames: this.generateValueNames,
      getTypeString: this.getTypeString
    }
  }
}
