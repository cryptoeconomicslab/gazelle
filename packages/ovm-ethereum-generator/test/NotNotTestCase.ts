import * as NotNotTest from '../build/NotNotTest.json'
import { ethers } from 'ethers'
import { encodeLabel, encodeProperty, TestContext } from '../src/helper'

const transactionA = '0x000001'
const transactionB = '0x000002'
const signature = '0x000003'

/**
 * @description This is the test case for Quantifier Translator optimization.
 *     See more detail about optimization at https://github.com/cryptoeconomicslab/research/tree/master/ovm-game-tree#challenge-rules
 * @param wallet
 */
export const createTestCaseOfNotNotP = (wallet: ethers.Wallet) => {
  return {
    name: '!(SignedBy(a, b).any()) or IsValidSignature(a, b, c)',
    deploy: [
      {
        contract: NotNotTest,
        getExtraArgs: (context: TestContext) => []
      }
    ],
    validChallenges: [
      {
        name:
          'valid challenge of NotNotTestO(a, b, c) should be NotNotTestO1N1T(b, c) and !IsValidSignature(a, b, c)',
        getTestData: (
          notNotTestPredicate: ethers.Contract,
          context: TestContext
        ) => {
          return {
            challengeInputs: [],
            // NotNotTestO(a, b, c)
            property: {
              predicateAddress: notNotTestPredicate.address,
              inputs: [
                encodeLabel('NotNotTestO'),
                transactionA,
                transactionB,
                signature
              ]
            },
            // NotNotTestO1N1T(b, c) and !IsValidSignature(a, b, c)
            challenge: {
              predicateAddress: context.and,
              inputs: [
                encodeProperty({
                  predicateAddress: notNotTestPredicate.address,
                  inputs: [
                    encodeLabel('NotNotTestO1N1T'),
                    transactionB,
                    signature
                  ]
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
        return { packedData: '0x6279746573206162797465732062' }
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
          packedData: '0x000001000002'
        }
      }
    }
  }
}
