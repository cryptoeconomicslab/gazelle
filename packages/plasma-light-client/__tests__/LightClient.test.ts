import LightClient from '../src/LightClient'
import StateManager from '../src/managers/StateManager'
import SyncManager from '../src/managers/SyncManager'
import DepositedRangeManager from '../src/managers/DepositedRangeManager'
import { setupContext } from '@cryptoeconomicslab/context'
import JsonCoder from '@cryptoeconomicslab/coder'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import { LevelKeyValueStore } from '@cryptoeconomicslab/level-kvs'
import { hint } from '@cryptoeconomicslab/ovm'

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

import {
  Address,
  Bytes,
  BigNumber,
  Integer,
  Property,
  Range
} from '@cryptoeconomicslab/primitives'
import { ethers } from 'ethers'
import { CheckpointManager } from '../src/managers'
import deciderConfig from './config.local'
import { DeciderConfig, CompiledPredicate } from '@cryptoeconomicslab/ovm'
import {
  StateUpdate,
  Exit,
  ExitDeposit,
  PlasmaContractConfig,
  Transaction,
  TransactionReceipt,
  Checkpoint
} from '@cryptoeconomicslab/plasma'
import { putWitness } from '@cryptoeconomicslab/db'
import { Balance } from '@cryptoeconomicslab/wallet'
import {
  Secp256k1Signer,
  secp256k1Verifier
} from '@cryptoeconomicslab/signature'
import {
  DoubleLayerInclusionProof,
  IntervalTreeInclusionProof,
  AddressTreeInclusionProof
} from '@cryptoeconomicslab/merkle-tree'
import { createDepositUserAction } from '../src/UserAction'
setupContext({ coder: JsonCoder })

// mock APIClient
const mockSendTransaction = jest
  .fn()
  .mockImplementation((txs: Transaction[] | Transaction) => {
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

// mock wallet
const MockWallet = jest.fn().mockImplementation(() => {
  const w = ethers.Wallet.createRandom()
  const signingKey = new ethers.utils.SigningKey(w.privateKey)
  const address = w.address

  return {
    getAddress: () => Address.from(address),
    getL1Balance: async (tokenAddress?: Address) => {
      return new Balance(BigNumber.from(0), 18, 'eth')
    },
    signMessage: async (message: Bytes) => {
      const signer = new Secp256k1Signer(
        Bytes.fromHexString(signingKey.privateKey)
      )
      return signer.sign(message)
    },
    verifyMySignature: async (message: Bytes, signature: Bytes) => {
      const publicKey = Bytes.fromHexString(address)
      return await secp256k1Verifier.verify(message, signature, publicKey)
    }
  }
})

async function initialize(aggregatorEndpoint?: string): Promise<LightClient> {
  const kvs = new LevelKeyValueStore(Bytes.fromString('root'))
  const witnessDb = await kvs.bucket(Bytes.fromString('witness'))
  const wallet = new MockWallet()
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

  return await LightClient.initilize({
    wallet,
    witnessDb,
    adjudicationContract,
    depositContractFactory,
    tokenContractFactory,
    commitmentContract,
    ownershipPayoutContract,
    deciderConfig: deciderConfig as DeciderConfig & PlasmaContractConfig,
    aggregatorEndpoint
  })
}
const erc20Address = deciderConfig.PlasmaETH
const depositContractAddress = deciderConfig.payoutContracts.DepositContract

describe('LightClient', () => {
  let client: LightClient
  beforeEach(async () => {
    MockAdjudicationContract.mockClear()
    MockDepositContract.mockClear()
    MockCommitmentContract.mockClear()
    MockERC20Contract.mockClear()

    client = await initialize()
    client.registerToken(erc20Address, depositContractAddress)
  })

  describe('initialize', () => {
    test('suceed to initialize', async () => {
      const client = await initialize()
      expect(client['stateManager']).toBeInstanceOf(StateManager)
      expect(client['syncManager']).toBeInstanceOf(SyncManager)
      expect(client['checkpointManager']).toBeInstanceOf(CheckpointManager)
      expect(client['depositedRangeManager']).toBeInstanceOf(
        DepositedRangeManager
      )
      expect(client['aggregatorEndpoint']).toEqual('http://localhost:3000')
    })
    test('initialize with aggregatorEndpoint', async () => {
      const aggregatorEndpoint = 'http://test.com'
      const client = await initialize(aggregatorEndpoint)
      expect(client['aggregatorEndpoint']).toEqual(aggregatorEndpoint)
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
        Address.from(
          deciderConfig.deployedPredicateTable.StateUpdatePredicate
            .deployedAddress
        ),
        Address.from(depositContractAddress),
        new Range(BigNumber.from(0), BigNumber.from(20)),
        BigNumber.from(0),
        client.ownershipProperty(Address.from(client.address))
      )
    })

    test('call sendTransaction without exception', async () => {
      await client['stateManager'].insertVerifiedStateUpdate(
        Address.from(depositContractAddress),
        su
      )

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
    let checkpoint: Checkpoint
    let checkpointPredicate: CompiledPredicate

    beforeAll(() => {
      su1 = new StateUpdate(
        Address.from(
          deciderConfig.deployedPredicateTable.StateUpdatePredicate
            .deployedAddress
        ),
        Address.from(depositContractAddress),
        new Range(BigNumber.from(0), BigNumber.from(20)),
        BigNumber.from(0),
        client.ownershipProperty(Address.from(client.address))
      )
      su2 = new StateUpdate(
        Address.from(
          deciderConfig.deployedPredicateTable.StateUpdatePredicate
            .deployedAddress
        ),
        Address.from(depositContractAddress),
        new Range(BigNumber.from(30), BigNumber.from(40)),
        BigNumber.from(1),
        client.ownershipProperty(Address.from(client.address))
      )

      proof = new DoubleLayerInclusionProof(
        new IntervalTreeInclusionProof(BigNumber.from(0), 0, []),
        new AddressTreeInclusionProof(Address.default(), 0, [])
      )

      checkpointPredicate = client['deciderManager'].compiledPredicateMap.get(
        'Checkpoint'
      ) as CompiledPredicate
      checkpoint = new Checkpoint(
        checkpointPredicate.deployedAddress,
        su1.property
      )
    })

    beforeEach(async () => {
      // let's say ownership stateupdate of range 0-20 and inclusion proof for that is stored in client.
      const { coder } = ovmContext

      // setup
      // store ownership stateupdate
      await client['stateManager'].insertVerifiedStateUpdate(
        Address.from(depositContractAddress),
        su1
      )
      await client['stateManager'].insertVerifiedStateUpdate(
        Address.from(depositContractAddress),
        su2
      )
      // store inclusion proof
      const hint1 = hint.createInclusionProofHint(
        su1.blockNumber,
        su1.depositContractAddress,
        su1.range
      )
      await putWitness(
        client['witnessDb'],
        hint1,
        coder.encode(proof.toStruct())
      )
      const hint2 = hint.createInclusionProofHint(
        su2.blockNumber,
        su2.depositContractAddress,
        su2.range
      )

      await putWitness(
        client['witnessDb'],
        hint2,
        coder.encode(proof.toStruct())
      )
    })

    test('startWithdrawal calls claimProperty of adjudicationContract', async () => {
      const { coder } = ovmContext
      await client.startWithdrawal(20, erc20Address)

      const exitProperty = (client['deciderManager'].compiledPredicateMap.get(
        'Exit'
      ) as CompiledPredicate).makeProperty([
        coder.encode(su1.property.toStruct()),
        coder.encode(proof.toStruct())
      ])
      expect(mockClaimProperty).toHaveBeenLastCalledWith(exitProperty)

      const exitingStateUpdate = await client[
        'stateManager'
      ].getExitStateUpdates(
        Address.from(depositContractAddress),
        new Range(BigNumber.from(0), BigNumber.from(20))
      )
      expect(exitingStateUpdate).toEqual([su1])
    })

    test('startWithdrawal calls claimProperty with exitDeposit property', async () => {
      // store checkpoint
      await client['checkpointManager'].insertCheckpointWithRange(
        Address.from(depositContractAddress),
        checkpoint
      )

      const { coder } = ovmContext
      await client.startWithdrawal(20, erc20Address)

      const exitProperty = (client['deciderManager'].compiledPredicateMap.get(
        'ExitDeposit'
      ) as CompiledPredicate).makeProperty([
        coder.encode(su1.property.toStruct()),
        coder.encode(checkpoint.property.toStruct())
      ])
      expect(mockClaimProperty).toHaveBeenLastCalledWith(exitProperty)
      // check pending withdrawal list
      const pendingWithdrawals = await client.getPendingWithdrawals()
      expect(pendingWithdrawals).toEqual([
        ExitDeposit.fromProperty(exitProperty)
      ])
    })

    test('startWithdrawal with multiple range', async () => {
      const { coder } = ovmContext
      await client.startWithdrawal(25, erc20Address)

      const exitProperty = (client['deciderManager'].compiledPredicateMap.get(
        'Exit'
      ) as CompiledPredicate).makeProperty([
        coder.encode(su1.property.toStruct()),
        coder.encode(proof.toStruct())
      ])
      su2.update({
        range: new Range(BigNumber.from(30), BigNumber.from(35))
      })
      const exitProperty2 = (client['deciderManager'].compiledPredicateMap.get(
        'Exit'
      ) as CompiledPredicate).makeProperty([
        coder.encode(su2.property.toStruct()),
        coder.encode(proof.toStruct())
      ])

      expect(mockClaimProperty).toHaveBeenCalledWith(exitProperty)
      expect(mockClaimProperty).toHaveBeenCalledWith(exitProperty2)

      const exitingStateUpdates = await client[
        'stateManager'
      ].getExitStateUpdates(
        Address.from(depositContractAddress),
        new Range(BigNumber.from(0), BigNumber.from(40))
      )
      expect(exitingStateUpdates).toEqual([su1, su2])
    })

    test('startWithdrawal calls fail with unsufficient amount', async () => {
      await expect(client.startWithdrawal(31, erc20Address)).rejects.toEqual(
        new Error('Insufficient amount')
      )
    })

    test('pendingWithdrawals', async () => {
      await client.startWithdrawal(25, erc20Address)
      const pendingWithdrawals = await client.getPendingWithdrawals()

      const { coder } = ovmContext
      const exitProperty = (client['deciderManager'].compiledPredicateMap.get(
        'Exit'
      ) as CompiledPredicate).makeProperty([
        coder.encode(su1.property.toStruct()),
        coder.encode(proof.toStruct())
      ])
      su2.update({
        range: new Range(BigNumber.from(30), BigNumber.from(35))
      })
      const exitProperty2 = (client['deciderManager'].compiledPredicateMap.get(
        'Exit'
      ) as CompiledPredicate).makeProperty([
        coder.encode(su2.property.toStruct()),
        coder.encode(proof.toStruct())
      ])

      expect(pendingWithdrawals).toEqual([
        Exit.fromProperty(exitProperty),
        Exit.fromProperty(exitProperty2)
      ])
    })

    test('completeWithdrawal', async () => {
      // setup depositedRangeId
      await client['depositedRangeManager'].extendRange(
        Address.from(depositContractAddress),
        new Range(BigNumber.from(0), BigNumber.from(50))
      )

      const { coder } = ovmContext
      const exitProperty = (client['deciderManager'].compiledPredicateMap.get(
        'Exit'
      ) as CompiledPredicate).makeProperty([
        coder.encode(su1.property.toStruct()),
        coder.encode(proof.toStruct())
      ])
      const exit = Exit.fromProperty(exitProperty)
      await client.completeWithdrawal(exit)

      expect(mockFinalizeExit).toHaveBeenLastCalledWith(
        exit.stateUpdate.depositContractAddress,
        exit.property,
        BigNumber.from(50),
        Address.from(client.address)
      )
    })

    test('completeWithdrawal with exitDeposit', async () => {
      // setup depositedRangeId
      await client['depositedRangeManager'].extendRange(
        Address.from(depositContractAddress),
        new Range(BigNumber.from(0), BigNumber.from(50))
      )

      const { coder } = ovmContext
      const exitProperty = (client['deciderManager'].compiledPredicateMap.get(
        'ExitDeposit'
      ) as CompiledPredicate).makeProperty([
        coder.encode(su1.property.toStruct()),
        coder.encode(checkpoint.property.toStruct())
      ])
      const exit = ExitDeposit.fromProperty(exitProperty)
      await client.completeWithdrawal(exit)

      expect(mockFinalizeExit).toHaveBeenLastCalledWith(
        exit.stateUpdate.depositContractAddress,
        exit.property,
        BigNumber.from(50),
        Address.from(client.address)
      )
    })

    test('fail to completeWithdrawal property is not decidable', async () => {
      mockIsDecided.mockResolvedValueOnce(false)
      mockIsDecidable.mockResolvedValueOnce(false)
      const { coder } = ovmContext
      const exitProperty = (client['deciderManager'].compiledPredicateMap.get(
        'Exit'
      ) as CompiledPredicate).makeProperty([
        coder.encode(su1.property.toStruct()),
        coder.encode(proof.toStruct())
      ])
      const exit = Exit.fromProperty(exitProperty)
      await expect(client.completeWithdrawal(exit)).rejects.toEqual(
        new Error(`Exit property is not decidable`)
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
        range,
        blockNumber
      )
      const db = await client['getUserActionDb'](blockNumber)
      await db.put(
        range.start.data,
        range.end.data,
        ovmContext.coder.encode(action.toStruct())
      )

      const actions = await client.getAllUserActions()
      expect(actions).toEqual([action])
    })
  })

  test('getOwner', () => {
    const owner = client.getOwner(
      new StateUpdate(
        Address.from(
          deciderConfig.deployedPredicateTable.StateUpdatePredicate
            .deployedAddress
        ),
        Address.from(depositContractAddress),
        new Range(BigNumber.from(0), BigNumber.from(20)),
        BigNumber.from(0),
        client.ownershipProperty(Address.from(client.address))
      )
    )
    expect(owner).toEqual(Address.from(client.address))
  })
})
