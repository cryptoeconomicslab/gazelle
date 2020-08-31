import LightClient from '../src/LightClient'
import {
  StateUpdateRepository,
  UserActionRepository,
  SyncRepository,
  InclusionProofRepository,
  DepositedRangeRepository
} from '../src/repository'
import { setupContext } from '@cryptoeconomicslab/context'
import EthCoder from '@cryptoeconomicslab/eth-coder'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import { InMemoryKeyValueStore } from '@cryptoeconomicslab/level-kvs'
import { getOwner } from '../src/helper/stateUpdateHelper'
import {
  Address,
  Bytes,
  BigNumber,
  Integer,
  Property,
  Range,
  FixedBytes
} from '@cryptoeconomicslab/primitives'
import deciderConfig from './config.local'
import { DeciderConfig } from '@cryptoeconomicslab/ovm'
import {
  StateUpdate,
  Exit,
  PlasmaContractConfig,
  TransactionReceipt,
  SignedTransaction
} from '@cryptoeconomicslab/plasma'
import {
  DoubleLayerInclusionProof,
  IntervalTreeInclusionProof,
  AddressTreeInclusionProof
} from '@cryptoeconomicslab/merkle-tree'
import { createDepositUserAction } from '../src/UserAction'
import { generateRandomWallet } from './helper/MockWallet'
import JSBI from 'jsbi'
setupContext({ coder: EthCoder })

const mockClaimProperty = jest.fn()
const mockIsDecided = jest.fn().mockResolvedValue(true)
const mockIsDecidable = jest.fn().mockResolvedValue(true)
const mockDecideClaimToTrue = jest.fn()
const mockGetClaimedProperties = jest.fn().mockResolvedValue([])
const MockAdjudicationContract = jest.fn().mockImplementation(() => {
  return {
    isDecided: mockIsDecided,
    isDecidable: mockIsDecidable,
    decideClaimToTrue: mockDecideClaimToTrue,
    claimProperty: mockClaimProperty,
    getClaimedProperties: mockGetClaimedProperties
  }
})

const mockDeposit = jest.fn()
const MockDepositContract = jest
  .fn()
  .mockImplementation((addr: Address, eventDb: KeyValueStore) => {
    return {
      address: addr,
      deposit: mockDeposit,
      subscribeDepositedRangeExtended: jest.fn(),
      subscribeDepositedRangeRemoved: jest.fn(),
      subscribeCheckpointFinalized: jest.fn(),
      startWatchingEvents: jest.fn()
    }
  })

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
})

const MockCommitmentContract = jest
  .fn()
  .mockImplementation((addr: Address, eventDb: KeyValueStore) => ({
    submitRoot: () => undefined,
    getCurrentBlock: jest.fn().mockResolvedValue(BigNumber.from(1))
  }))

const mockFinalizeExit = jest.fn()
const MockOwnershipPayoutContract = jest.fn().mockImplementation(() => {
  return {
    finalizeExit: mockFinalizeExit
  }
})

const mockClaim = jest.fn()
const mockChallenge = jest.fn()
const mockRemoveChallenge = jest.fn()
const mockSettle = jest.fn()
const mockSubscribeCheckpointChallenged = jest.fn()
const mockSubscribeCheckpointClaimed = jest.fn()
const mockSubscribeCheckpointSettled = jest.fn()
const mockSubscribeCheckpointChallengeRemoved = jest.fn()
const MockCheckpointDisputeContract = jest.fn().mockImplementation(() => {
  return {
    claim: mockClaim,
    challenge: mockChallenge,
    removeChallenge: mockRemoveChallenge,
    settle: mockSettle,
    subscribeCheckpointClaimed: mockSubscribeCheckpointClaimed,
    subscribeCheckpointChallenged: mockSubscribeCheckpointChallenged,
    subscribeCheckpointChallengeRemoved: mockSubscribeCheckpointChallengeRemoved,
    subscribeCheckpointSettled: mockSubscribeCheckpointSettled,
    startWatchingEvents: jest.fn(),
    unsubscribeAll: jest.fn()
  }
})

const mockExitDisputeFunctions = {
  mockClaim: jest.fn(),
  mockChallenge: jest.fn(),
  mockRemoveChallenge: jest.fn(),
  mockSettle: jest.fn(),
  mockSubscribeExitClaim: jest.fn(),
  mockSubscribeExitChallenged: jest.fn(),
  mockSubscribeExitSettled: jest.fn()
}

const MockExitDisputeContract = jest.fn().mockImplementation(() => {
  return {
    claim: mockExitDisputeFunctions.mockClaim,
    challenge: mockExitDisputeFunctions.mockChallenge,
    settle: mockExitDisputeFunctions.mockSettle,
    removeChallenge: mockExitDisputeFunctions.mockRemoveChallenge,
    subscribeExitClaimed: mockExitDisputeFunctions.mockSubscribeExitClaim,
    subscribeExitChallenged:
      mockExitDisputeFunctions.mockSubscribeExitChallenged,
    subscribeExitSettled: mockExitDisputeFunctions.mockSubscribeExitSettled,
    startWatchingEvents: jest.fn(),
    unsubscribeAll: jest.fn()
  }
})

function clearMocks() {
  MockExitDisputeContract.mockClear()
  Object.values(mockExitDisputeFunctions).forEach(mock => mock.mockClear())
}

// mock APIClient
const mockSendTransaction = jest
  .fn()
  .mockImplementation((txs: SignedTransaction[] | SignedTransaction) => {
    if (Array.isArray(txs)) {
      const tx = txs[0]
      return {
        data: [
          ovmContext.coder
            .encode(
              new TransactionReceipt(
                Integer.from(1),
                tx.maxBlockNumber,
                [BigNumber.from(0)],
                tx.range,
                tx.depositContractAddress,
                tx.from,
                tx.getHash()
              ).toStruct()
            )
            .toHexString()
        ]
      }
    }
  })
jest.mock('../src/APIClient', () => {
  return jest.fn().mockImplementation(() => {
    return {
      syncState: jest.fn(),
      inclusionProof: jest.fn(),
      sendTransaction: mockSendTransaction
    }
  })
})

// returns LightClient instance and witnessDb instance
async function initialize(
  aggregatorEndpoint?: string
): Promise<{ lightClient: LightClient; witnessDb: KeyValueStore }> {
  const kvs = new InMemoryKeyValueStore(Bytes.fromString('root'))
  const witnessDb = await kvs.bucket(Bytes.fromString('witness'))
  const wallet = generateRandomWallet()
  const eventDb = await kvs.bucket(Bytes.fromString('event'))
  const adjudicationContract = new MockAdjudicationContract(
    Address.from('0x8f0483125FCb9aaAEFA9209D8E9d7b9C8B9Fb90F'),
    eventDb
  )
  const depositContractFactory = (addr: Address) => {
    return new MockDepositContract(addr, eventDb)
  }
  const tokenContractFactory = (addr: Address) => {
    return new MockERC20Contract(addr)
  }
  const commitmentContract = new MockCommitmentContract(
    Address.from('0x8CdaF0CD259887258Bc13a92C0a6dA92698644C0'),
    eventDb
  )
  const ownershipPayoutContract = new MockOwnershipPayoutContract()
  const checkpointDisputeContract = new MockCheckpointDisputeContract()
  const exitDisputeContract = new MockExitDisputeContract()

  const lightClient = await LightClient.initilize({
    wallet,
    witnessDb,
    adjudicationContract,
    depositContractFactory,
    tokenContractFactory,
    commitmentContract,
    ownershipPayoutContract,
    checkpointDisputeContract,
    exitDisputeContract,
    deciderConfig: deciderConfig as DeciderConfig & PlasmaContractConfig,
    aggregatorEndpoint
  })

  return { lightClient, witnessDb }
}
const erc20Address = deciderConfig.PlasmaETH
const depositContractAddress = deciderConfig.payoutContracts.DepositContract

describe('LightClient', () => {
  let client: LightClient
  let db: KeyValueStore

  beforeEach(async () => {
    MockAdjudicationContract.mockClear()
    MockDepositContract.mockClear()
    MockCommitmentContract.mockClear()
    MockERC20Contract.mockClear()
    clearMocks()

    const { lightClient, witnessDb } = await initialize()
    client = lightClient
    db = witnessDb
    await client.registerToken(erc20Address, depositContractAddress)
  })

  describe('initialize', () => {
    test('suceed to initialize', async () => {
      const { lightClient } = await initialize()
      expect(lightClient['aggregatorEndpoint']).toEqual('http://localhost:3000')
    })
    test('initialize with aggregatorEndpoint', async () => {
      const aggregatorEndpoint = 'http://test.com'
      const { lightClient } = await initialize(aggregatorEndpoint)
      expect(lightClient['aggregatorEndpoint']).toEqual(aggregatorEndpoint)
    })
  })

  describe('deposit', () => {
    test('deposit calls contract methods', async () => {
      // setup mock values
      await client.deposit(20, erc20Address)

      expect(mockApprove).toHaveBeenLastCalledWith(
        Address.from(depositContractAddress),
        BigNumber.from(20)
      )

      expect(mockDeposit).toHaveBeenLastCalledWith(
        BigNumber.from(20),
        client.ownershipProperty(Address.from(client.address))
      )
    })

    test('deposit with large number as string', async () => {
      await client.deposit('10000000000000000', erc20Address)

      expect(mockApprove).toHaveBeenLastCalledWith(
        Address.from(depositContractAddress),
        BigNumber.fromString('10000000000000000')
      )

      expect(mockDeposit).toHaveBeenLastCalledWith(
        BigNumber.fromString('10000000000000000'),
        client.ownershipProperty(Address.from(client.address))
      )
    })

    test('deposit calls to unregistered contract should fail', async () => {
      await expect(
        client.deposit(20, Address.from('0x00000000000000000001').data)
      ).rejects.toEqual(new Error('Token Contract not found'))
    })
  })

  describe('sendTransaction', () => {
    let su: StateUpdate

    beforeAll(() => {
      mockSendTransaction.mockClear()
      su = new StateUpdate(
        Address.from(depositContractAddress),
        new Range(BigNumber.from(0), BigNumber.from(20)),
        BigNumber.from(0),
        client.ownershipProperty(Address.from(client.address)),
        FixedBytes.default(32)
      )
    })

    test('call sendTransaction without exception', async () => {
      const repository = await StateUpdateRepository.init(db)
      await repository.insertVerifiedStateUpdate(su)

      await client.sendTransaction(
        10,
        erc20Address,
        new Property(Address.default(), [])
      )
      expect(mockSendTransaction).toBeCalled()
    })

    test('sendTransaction throw exception of not enough amount', async () => {
      await expect(
        client.sendTransaction(
          50,
          erc20Address,
          new Property(Address.default(), [])
        )
      ).rejects.toEqual(new Error('Not enough amount'))
    })
  })

  describe('startWithdrawal', () => {
    let su1: StateUpdate
    let su2: StateUpdate
    let proof: DoubleLayerInclusionProof

    beforeAll(() => {
      su1 = new StateUpdate(
        Address.from(depositContractAddress),
        new Range(BigNumber.from(0), BigNumber.from(20)),
        BigNumber.from(0),
        client.ownershipProperty(Address.from(client.address)),
        FixedBytes.default(32)
      )
      su2 = new StateUpdate(
        Address.from(depositContractAddress),
        new Range(BigNumber.from(30), BigNumber.from(40)),
        BigNumber.from(1),
        client.ownershipProperty(Address.from(client.address)),
        FixedBytes.default(32)
      )

      proof = new DoubleLayerInclusionProof(
        new IntervalTreeInclusionProof(BigNumber.from(0), 0, []),
        new AddressTreeInclusionProof(Address.default(), 0, [])
      )
    })

    beforeEach(async () => {
      // let's say ownership stateupdate of range 0-20 and inclusion proof for that is stored in client.
      const repository = await StateUpdateRepository.init(db)

      // setup
      // store ownership stateupdate
      await repository.insertVerifiedStateUpdate(su1)
      await repository.insertVerifiedStateUpdate(su2)
      // store inclusion proof
      const inclusionProofRepo = await InclusionProofRepository.init(db)
      await inclusionProofRepo.insertInclusionProof(
        su1.depositContractAddress,
        su1.blockNumber,
        su1.range,
        proof
      )
      await inclusionProofRepo.insertInclusionProof(
        su2.depositContractAddress,
        su2.blockNumber,
        su2.range,
        proof
      )
      const depositedRepo = await DepositedRangeRepository.init(db)
      await depositedRepo.extendRange(
        Address.from(depositContractAddress),
        su1.range
      )
      await depositedRepo.extendRange(
        Address.from(depositContractAddress),
        su2.range
      )
    })

    test('startWithdrawal calls claimProperty of adjudicationContract', async () => {
      await client.startWithdrawal(20, erc20Address)

      expect(mockExitDisputeFunctions.mockClaim).toHaveBeenCalledWith(
        su1,
        proof
      )
    })

    test('startWithdrawal with multiple range', async () => {
      await client.startWithdrawal(25, erc20Address)
      su2.update({
        range: new Range(
          su2.range.start,
          BigNumber.from(JSBI.add(su2.range.start.data, JSBI.BigInt(5)))
        )
      })

      expect(mockExitDisputeFunctions.mockClaim).toHaveBeenCalledWith(
        su1,
        proof
      )
      expect(mockExitDisputeFunctions.mockClaim).toHaveBeenCalledWith(
        su2,
        proof
      )
    })

    test('startWithdrawal calls fail with unsufficient amount', async () => {
      await expect(client.startWithdrawal(31, erc20Address)).rejects.toEqual(
        new Error('Insufficient amount')
      )
    })

    test.skip('pendingWithdrawals', async () => {
      const syncRepo = await SyncRepository.init(db)
      const blockNumber = await syncRepo.getSyncedBlockNumber()

      await client.startWithdrawal(25, erc20Address)
      const pendingWithdrawals = await client.getPendingWithdrawals()

      expect(pendingWithdrawals).toEqual([
        new Exit(su1, blockNumber),
        new Exit(su2, blockNumber)
      ])
    })

    test.skip('fail to completeWithdrawal property is not decidable', async () => {
      const syncRepo = await SyncRepository.init(db)
      const blockNumber = await syncRepo.getNextBlockNumber()

      const exit = new Exit(su1, blockNumber)
      await expect(client.completeWithdrawal(exit)).rejects.toEqual(
        new Error('Exit dispute period have not been passed')
      )
    })
  })

  describe('getAllUserActions', () => {
    test('get an action', async () => {
      const tokenContractAddress = Address.from(erc20Address)
      const range = new Range(BigNumber.from(0), BigNumber.from(100))
      const blockNumber = BigNumber.from(1)
      const action = createDepositUserAction(
        tokenContractAddress,
        [range],
        blockNumber,
        FixedBytes.default(32)
      )
      const repository = await UserActionRepository.init(db)
      await repository.insertAction(blockNumber, range, action)
      const actions = await client.getAllUserActions()
      expect(actions).toEqual([action])
    })
  })

  test('getOwner', () => {
    const owner = getOwner(
      new StateUpdate(
        Address.from(depositContractAddress),
        new Range(BigNumber.from(0), BigNumber.from(20)),
        BigNumber.from(0),
        client.ownershipProperty(Address.from(client.address)),
        FixedBytes.default(32)
      )
    )
    expect(owner).toEqual(Address.from(client.address))
  })
})
