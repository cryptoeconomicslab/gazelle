import * as DynamicCallerTest from '../build/DynamicCallerTest.json'
import * as DynamicCalledTest from '../build/DynamicCalledTest.json'
import { ethers } from 'ethers'
import {
  encodeLabel,
  encodeString,
  encodeProperty,
  encodeVariable,
  encodeInteger,
  encodeChildWitnesses,
  TestCaseSet,
  TestContext
} from '../src/helper'

const inputA = '0x000000000000000000000000000000000000000001'
const inputB = '0x000000000000000000000000000000000000000002'
const inputC = '0x000000000000000000000000000000000000000003'
const signature = '0x000000000000000000000000000000000000000003'

export const createTestCaseOfDynamicLink = (
  wallet: ethers.Wallet
): TestCaseSet => {
  return {
    name:
      'def DynamicCallerTest(a, b, c) := DynamicCalledTest(a, b) and IsValidSignature(a, b, c)',
    deploy: [
      {
        contract: DynamicCalledTest,
        getExtraArgs: (context: TestContext) => []
      },
      {
        contract: DynamicCallerTest,
        getExtraArgs: (context: TestContext) => [
          context.deployedContractAddresses[0]
        ]
      }
    ],
    validChallenges: [],
    invalidChallenges: [],
    decideTrueTestCases: [
      {
        name: 'DynamicCallerTest(a, b, c) should be true',
        getTestData: (
          andTestPredicate: ethers.Contract,
          context: TestContext
        ) => {
          return {
            inputs: [encodeLabel('DynamicCallerTestA'), inputA, inputB, inputC],
            witnesses: [
              encodeChildWitnesses([signature]),
              encodeChildWitnesses([signature])
            ]
          }
        }
      }
    ],
    invalidDecideTestCases: [
      {
        name: 'should throw exception',
        getTestData: (
          andTestPredicate: ethers.Contract,
          context: TestContext
        ) => {
          return {
            inputs: [encodeLabel('DynamicCallerTestA'), inputA],
            witnesses: [signature]
          }
        }
      }
    ],
    packTypesTestCases: {
      name: 'packTypes a b',
      getTestData: (
        notNotTestPredicate: ethers.Contract,
        context: TestContext
      ) => {
        return { packedData: '0x6279746573206162797465732062' }
      }
    },
    packValuesTestCases: {
      name: 'pack a b c',
      getTestData: (
        notNotTestPredicate: ethers.Contract,
        context: TestContext
      ) => {
        return {
          inputs: [inputA, inputB, inputC],
          packedData:
            '0x000000000000000000000000000000000000000001000000000000000000000000000000000000000002'
        }
      }
    }
  }
}
