import TokenManager from '../src/managers/TokenManager'
import { Integer, Address } from '@cryptoeconomicslab/primitives'
import {
  IERC20DetailedContract,
  IDepositContract
} from '@cryptoeconomicslab/contract'
import deciderConfig from './config.local'

const mockApprove = jest.fn()
const mockName = jest.fn().mockImplementation(() => 'PlasmaETH')
const mockSymbol = jest.fn().mockImplementation(() => 'PETH')
const mockDecimals = jest.fn().mockImplementation(() => Integer.from(6))
const MockERC20Contract = jest.fn().mockImplementation((address: Address) => {
  return {
    approve: mockApprove,
    name: mockName,
    symbol: mockSymbol,
    decimals: mockDecimals,
    address
  }
}) as jest.Mock<IERC20DetailedContract>

const MockDepositContract = jest.fn().mockImplementation((address: Address) => {
  return { address }
}) as jest.Mock<IDepositContract>

describe('TokenManager', () => {
  let tokenManager: TokenManager
  const depositContractAddress = Address.from(
    deciderConfig.payoutContracts.DepositContract
  )
  const tokenContractAddress = Address.from(deciderConfig.PlasmaETH)

  beforeEach(async () => {
    mockApprove.mockClear()
    mockDecimals.mockClear()
    MockERC20Contract.mockClear()
    tokenManager = new TokenManager()
  })

  test('get depositContractAddresses', () => {
    tokenManager.addDepositContract(
      depositContractAddress,
      new MockDepositContract(depositContractAddress)
    )
    expect(tokenManager.depositContractAddresses).toEqual([
      depositContractAddress
    ])
  })

  test('get tokenContractAddresses', () => {
    tokenManager.addTokenContract(new MockERC20Contract(tokenContractAddress))
    expect(tokenManager.tokenContractAddresses).toEqual([tokenContractAddress])
  })

  test('add token', async () => {
    await tokenManager.addContracts(
      new MockERC20Contract(tokenContractAddress),
      new MockDepositContract(depositContractAddress)
    )
    const tokenContract = tokenManager.getTokenContract(tokenContractAddress)
    expect(tokenContract).not.toBeUndefined()
    expect(tokenContract?.address).toEqual(tokenContractAddress)
    const depositContract = tokenManager.getDepositContract(
      depositContractAddress
    )
    expect(depositContract).not.toBeUndefined()
    expect(depositContract?.address).toEqual(depositContractAddress)
    expect(
      tokenManager.getDepositContractAddress(tokenContractAddress)
    ).toEqual(depositContractAddress.data)
    expect(
      tokenManager.getTokenContractAddress(depositContractAddress)
    ).toEqual(tokenContractAddress.data)
  })

  test('addTokenContract and getTokenContract', async () => {
    await tokenManager.addTokenContract(
      new MockERC20Contract(tokenContractAddress)
    )
    const tokenContract = tokenManager.getTokenContract(tokenContractAddress)
    expect(tokenContract).not.toBeUndefined()
    expect(tokenContract?.address).toEqual(tokenContractAddress)
  })

  test('addDepositContract and getDepositContract', () => {
    tokenManager.addDepositContract(
      depositContractAddress,
      new MockDepositContract(depositContractAddress)
    )
    const depositContract = tokenManager.getDepositContract(
      depositContractAddress
    )
    expect(depositContract).not.toBeUndefined()
    expect(depositContract?.address).toEqual(depositContractAddress)
  })

  test('addTokenContract and getName', async () => {
    await tokenManager.addTokenContract(
      new MockERC20Contract(tokenContractAddress)
    )
    expect(tokenManager.getName(tokenContractAddress)).toEqual('PlasmaETH')
  })

  test('getName throw exception', async () => {
    expect(() => {
      tokenManager.getName(tokenContractAddress)
    }).toThrow(`Token Contract of (${tokenContractAddress.data}) not found.`)
  })

  test('addTokenContract and getSymbol', async () => {
    await tokenManager.addTokenContract(
      new MockERC20Contract(tokenContractAddress)
    )
    expect(tokenManager.getSymbol(tokenContractAddress)).toEqual('PETH')
  })

  test('getSymbol throw exception', async () => {
    expect(() => {
      tokenManager.getSymbol(tokenContractAddress)
    }).toThrow(`Token Contract of (${tokenContractAddress.data}) not found.`)
  })

  test('addTokenContract and getDecimals', async () => {
    await tokenManager.addTokenContract(
      new MockERC20Contract(tokenContractAddress)
    )
    expect(tokenManager.getDecimal(tokenContractAddress)).toEqual(6)
  })

  test('getDecimals throw exception', async () => {
    expect(() => {
      tokenManager.getDecimal(tokenContractAddress)
    }).toThrow(`Token Contract of (${tokenContractAddress.data}) not found.`)
  })
})
