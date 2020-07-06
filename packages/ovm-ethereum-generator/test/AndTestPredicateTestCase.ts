import * as AndTest from '../build/AndTest.json'
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

const transactionA = '0x000001'
const transactionB = '0x000002'
const signature = '0x000003'

export const createTestCaseOfAndLogicalConnective = (
  wallet: ethers.Wallet
): TestCaseSet => {
  return {
    name: 'SignedBy(txA, txB).any() and SignedBy(txA, txB).any()',
    deploy: [
      {
        contract: AndTest,
        getExtraArgs: (context: TestContext) => []
      }
    ],
    validChallenges: [
      {
        name:
          'valid challenge of SignedBy(a, b).any() and SignedBy(a, b).any() should be Bytes().all(v0 -> !IsValidSignature(a, b, v0))',
        getTestData: (
          andTestPredicate: ethers.Contract,
          context: TestContext
        ) => {
          return {
            challengeInputs: [encodeInteger(1)],
            property: {
              predicateAddress: andTestPredicate.address,
              inputs: [encodeLabel('AndTestA'), transactionA, transactionB]
            },
            challenge: {
              predicateAddress: context.forAllSuchThat,
              inputs: [
                '0x',
                encodeString('v0'),
                encodeProperty({
                  predicateAddress: context.not,
                  inputs: [
                    encodeProperty({
                      predicateAddress: context.mockAtomicPredicate,
                      inputs: [transactionA, transactionB, encodeVariable('v0')]
                    })
                  ]
                })
              ]
            }
          }
        }
      }
    ],
    invalidChallenges: [],
    decideTrueTestCases: [
      {
        name: 'should be true',
        getTestData: (
          andTestPredicate: ethers.Contract,
          context: TestContext
        ) => {
          return {
            inputs: [encodeLabel('AndTestA'), transactionA, transactionB],
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
            inputs: [encodeLabel('AndTestA'), transactionB],
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
        return { packedData: '0x62797465732061' }
      }
    },
    packValuesTestCases: {
      name: 'pack a b',
      getTestData: (
        notNotTestPredicate: ethers.Contract,
        context: TestContext
      ) => {
        return {
          inputs: [transactionA, transactionB],
          packedData: '0x000001'
        }
      }
    }
  }
}
