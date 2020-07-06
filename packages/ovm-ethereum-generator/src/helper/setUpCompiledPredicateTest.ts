import chai from 'chai'
import { ethers } from 'ethers'
import {
  createMockProvider,
  deployContract,
  solidity,
  getWallets
} from 'ethereum-waffle'
import { randomAddress, deployCompiledPredicate } from '../helper'
import { TestCaseSet, TestContext } from './testCase'
import chaiAsPromised from 'chai-as-promised'

chai.use(solidity)
chai.use(chaiAsPromised)
const { expect, assert } = chai

export interface SetUpCompiledPredicateTestOptions {
  gasLimit: number
}

/**
 * @name setUpCompiledPredicateTest
 * @description test utility for unit test of Predicates
 * @param name test name
 * @param createTestCases creating TestCaseSets function
 * @param MockAtomicPredicate ContractJSON of MockAtomicPredicate
 * @param MockCompiledPredicate ContractJSON of MockCompiledPredicate
 * @param Utils ContractJSON of Utils contract
 * @param MockAdjudicationContract ContractJSON of Adjudication contract
 * @param options test options
 */
export function setUpCompiledPredicateTest(
  name: string,
  createTestCases: (wallet: ethers.Wallet) => TestCaseSet[],
  MockAtomicPredicate: any,
  MockCompiledPredicate: any,
  Utils: any,
  MockAdjudicationContract: any,
  options: SetUpCompiledPredicateTestOptions = { gasLimit: 6_000_000 }
) {
  describe(name, () => {
    const provider = createMockProvider()
    const wallets = getWallets(provider)
    const wallet = wallets[0]
    const notAddress = randomAddress()
    const andAddress = randomAddress()
    const forAllSuchThatAddress = randomAddress()
    const ownershipPayout = randomAddress()
    let mockAtomicPredicate: ethers.Contract
    let mockCompiledPredicate: ethers.Contract
    let testContext: TestContext

    beforeEach(async () => {
      mockAtomicPredicate = await deployContract(
        wallet,
        MockAtomicPredicate,
        []
      )
      mockCompiledPredicate = await deployContract(
        wallet,
        MockCompiledPredicate,
        []
      )
      testContext = {
        not: notAddress,
        and: andAddress,
        forAllSuchThat: forAllSuchThatAddress,
        mockAtomicPredicate: mockAtomicPredicate.address,
        mockCompiledPredicate: mockCompiledPredicate.address,
        payout: ownershipPayout,
        gasLimit: options.gasLimit,
        deployedContractAddresses: []
      }
    })

    const testcases = createTestCases(wallet)

    testcases.forEach(testcase => {
      describe(testcase.name, () => {
        let targetPredicate: ethers.Contract
        beforeEach(async () => {
          targetPredicate = await deployCompiledPredicate(
            wallet,
            Utils,
            MockAdjudicationContract,
            testcase,
            testContext
          )
        })

        describe('isValidChallenge', () => {
          testcase.validChallenges.forEach(validChallenge => {
            it(validChallenge.name, async () => {
              const challengeTestCase = validChallenge.getTestData(
                targetPredicate,
                testContext
              )
              const result = await targetPredicate.isValidChallenge(
                challengeTestCase.property.inputs,
                challengeTestCase.challengeInputs,
                challengeTestCase.challenge
              )
              assert.isTrue(result)
            })
          })

          testcase.invalidChallenges.forEach(invalidChallenge => {
            it(invalidChallenge.name, async () => {
              const challengeTestCase = invalidChallenge.getTestData(
                targetPredicate,
                testContext
              )
              await expect(
                targetPredicate.isValidChallenge(
                  challengeTestCase.property.inputs,
                  challengeTestCase.challengeInputs,
                  challengeTestCase.challenge
                )
              ).to.be.reverted
            })
          })
        })

        describe('decide', () => {
          testcase.decideTrueTestCases.forEach(decideTrueTestCase => {
            it(decideTrueTestCase.name, async () => {
              const decideTestCase = decideTrueTestCase.getTestData(
                targetPredicate,
                testContext
              )
              const result = await targetPredicate.decide(
                decideTestCase.inputs,
                decideTestCase.witnesses
              )
              assert.isTrue(result)
            })
          })

          testcase.invalidDecideTestCases.forEach(decideTrueTestCase => {
            it(decideTrueTestCase.name, async () => {
              const decideTestCase = decideTrueTestCase.getTestData(
                targetPredicate,
                testContext
              )
              await expect(
                targetPredicate.decide(
                  decideTestCase.inputs,
                  decideTestCase.witnesses
                )
              ).to.be.reverted
            })
          })
        })

        describe('packTypes', () => {
          it('packTypes return types bytes', async () => {
            const result = await targetPredicate.packTypes()
            expect(result).to.be.eq(
              testcase.packTypesTestCases.getTestData(
                targetPredicate,
                testContext
              ).packedData
            )
          })
        })

        describe('packValues return values bytes', () => {
          it('packValues return', async () => {
            const packValuesTestData = testcase.packValuesTestCases.getTestData(
              targetPredicate,
              testContext
            )
            const result = await targetPredicate.packValues(
              packValuesTestData.inputs
            )
            expect(result).to.be.eq(packValuesTestData.packedData)
          })
        })
      })
    })
  })
}
