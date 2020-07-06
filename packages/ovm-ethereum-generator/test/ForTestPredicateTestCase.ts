import * as ForTest from '../build/ForTest.json'
import { ethers } from 'ethers'
import { encodeLabel, encodeProperty, TestContext } from '../src/helper'

const transactionA = '0x000001'
const transactionB = '0x000002'
const signature = '0x000003'

export const createTestCaseOfForAllSuchThatQuantifier = (
  wallet: ethers.Wallet
) => {
  return {
    name: 'SignedBy(a, b).all(c -> IsValidSignature(a, b, c))',
    deploy: [
      {
        contract: ForTest,
        getExtraArgs: (context: TestContext) => []
      }
    ],
    validChallenges: [
      {
        name:
          'valid challenge of ForTestF(a, b, c) should be IsValidSignature(a, b, c) and !IsValidSignature(a, b, c)',
        getTestData: (
          forTestPredicate: ethers.Contract,
          context: TestContext
        ) => {
          return {
            challengeInputs: [signature],
            property: {
              predicateAddress: forTestPredicate.address,
              inputs: [encodeLabel('ForTestF'), transactionA, transactionB]
            },
            challenge: {
              predicateAddress: context.and,
              inputs: [
                encodeProperty({
                  predicateAddress: context.mockAtomicPredicate,
                  inputs: [transactionA, transactionB, signature]
                }),
                encodeProperty({
                  predicateAddress: context.not,
                  inputs: [
                    encodeProperty({
                      predicateAddress: context.mockAtomicPredicate,
                      inputs: [transactionA, transactionB, signature]
                    })
                  ]
                })
              ]
            }
          }
        }
      },
      {
        name:
          'valid challenge of ForTestFO1N(a, b, c) should be IsValidSignature(a, b, c)',
        getTestData: (
          forTestPredicate: ethers.Contract,
          context: TestContext
        ) => {
          return {
            challengeInputs: [signature, '0x'],
            property: {
              predicateAddress: forTestPredicate.address,
              inputs: [
                encodeLabel('ForTestFO1N'),
                transactionA,
                transactionB,
                signature
              ]
            },
            challenge: {
              predicateAddress: context.mockAtomicPredicate,
              inputs: [transactionA, transactionB, signature]
            }
          }
        }
      }
    ],
    invalidChallenges: [],
    decideTrueTestCases: [],
    invalidDecideTestCases: [],
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
