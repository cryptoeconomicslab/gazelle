import { ethers } from 'ethers'
import { OvmProperty } from './utils'

export interface TestCase<T> {
  name: string
  getTestData: (targetPredicate: ethers.Contract, context: TestContext) => T
}

/**
 * isValidChallenge method confirms `challenge` is valid challenge of `property` using `challengeInputs`
 */
export interface IsValidChallengeTestData {
  challengeInputs: string[]
  property: OvmProperty
  challenge: OvmProperty
}

/**
 * decide method succeeds when a property which has `inputs` can prove true using `witnesses`
 */
export interface DecideTestData {
  inputs: string[]
  witnesses: string[]
}

interface PackTypesTestData {
  packedData: string
}

interface PackValuesTestData {
  inputs: string[]
  packedData: string
}

export interface TestContext {
  forAllSuchThat: string
  and: string
  not: string
  mockAtomicPredicate: string
  mockCompiledPredicate: string
  payout: string
  gasLimit: number
  deployedContractAddresses: string[]
}

export interface TestCaseSet {
  name: string
  deploy: {
    contract: any
    getExtraArgs: (context: TestContext) => string[]
  }[]
  validChallenges: TestCase<IsValidChallengeTestData>[]
  invalidChallenges: TestCase<IsValidChallengeTestData>[]
  decideTrueTestCases: TestCase<DecideTestData>[]
  invalidDecideTestCases: TestCase<DecideTestData>[]
  packTypesTestCases: TestCase<PackTypesTestData>
  packValuesTestCases: TestCase<PackValuesTestData>
}
