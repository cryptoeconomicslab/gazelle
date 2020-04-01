import { deployCompiledPredicate } from '../../src/helper/deployCompiledPredicate'
import * as ethers from 'ethers'
import { TestContext } from '../../src/helper'
const mockAddress = ethers.constants.AddressZero
jest.mock('ethereum-waffle', () => {
  return {
    deployContract: jest.fn().mockImplementation(() => {
      return {
        address: mockAddress,
        setPredicateAddresses: jest.fn().mockImplementation(() => {})
      }
    })
  }
})

describe('deployCompiledPredicate', () => {
  const mockContractJSON = { abi: [], bytecode: '' }
  const mockTestContext = {
    and: '',
    deployedContractAddresses: [],
    forAllSuchThat: '',
    not: '',
    mockAtomicPredicate: '',
    mockCompiledPredicate: '',
    payout: '',
    gasLimit: 0
  }

  test('succeed to deploy', async () => {
    const compiledPredicate = await deployCompiledPredicate(
      ethers.Wallet.createRandom(),
      mockContractJSON,
      mockContractJSON,
      {
        name: '',
        deploy: [
          {
            contract: mockContractJSON,
            getExtraArgs: (context: TestContext) => []
          }
        ],
        validChallenges: [],
        invalidChallenges: [],
        decideTrueTestCases: [],
        invalidDecideTestCases: []
      },
      mockTestContext
    )
    expect(compiledPredicate.address).toBe(mockAddress)
  })
})
