import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.join(__dirname, '.test.env') })

import Aggregator from '../src/Aggregator'
import {
  DepositTransaction,
  Transaction,
  StateUpdate,
  TRANSACTION_STATUS,
  PlasmaContractConfig
} from '@cryptoeconomicslab/plasma'
import { InMemoryKeyValueStore } from '@cryptoeconomicslab/level-kvs'
import { RangeStore, RangeDb, KeyValueStore } from '@cryptoeconomicslab/db'
import { DeciderConfig, CompiledPredicate } from '@cryptoeconomicslab/ovm'
import {
  Address,
  Bytes,
  BigNumber,
  Range
} from '@cryptoeconomicslab/primitives'
import { EthCoder as Coder } from '@cryptoeconomicslab/eth-coder'
import { Wallet, Balance } from '@cryptoeconomicslab/wallet'
import {
  Secp256k1Signer,
  secp256k1Verifier
} from '@cryptoeconomicslab/signature'
import { setupContext } from '@cryptoeconomicslab/context'
import config from './config.local'
setupContext({
  coder: Coder
})

import { BlockManager, StateManager } from '../src/managers'
import { ethers } from 'ethers'

// Setup mock contract
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

const MockCommitmentContract = jest
  .fn()
  .mockImplementation((addr: Address, eventDb: KeyValueStore) => ({
    submitRoot: () => undefined
  }))

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

const ALIS_WALLET = new MockWallet()
const ALIS_ADDRESS = ALIS_WALLET.getAddress()
const BOB_WALLET = new MockWallet()
const BOB_ADDRESS = BOB_WALLET.getAddress()

describe('Aggregator integration', () => {
  let aggregator: Aggregator,
    stateDb: RangeStore,
    stateManager: StateManager,
    blockDb: KeyValueStore,
    blockManager: BlockManager,
    kvs: KeyValueStore,
    stateBucket: KeyValueStore,
    wallet: Wallet,
    witnessDb: KeyValueStore,
    eventDb: KeyValueStore

  beforeEach(async () => {
    kvs = new InMemoryKeyValueStore(Bytes.fromString('test-db'))
    stateBucket = await kvs.bucket(Bytes.fromString('state_update'))
    stateDb = new RangeDb(stateBucket)
    blockDb = await kvs.bucket(Bytes.fromString('block'))
    stateManager = new StateManager(stateDb)
    blockManager = new BlockManager(blockDb)
    witnessDb = await kvs.bucket(Bytes.fromString('witness'))
    eventDb = await kvs.bucket(Bytes.fromString('event'))
    wallet = new MockWallet()

    function depositContractFactory(address: Address) {
      return new MockDepositContract(address, eventDb)
    }
    function commitmentContractFactory(address: Address) {
      return new MockCommitmentContract(address, eventDb)
    }
    aggregator = new Aggregator(
      wallet,
      stateManager,
      blockManager,
      witnessDb,
      depositContractFactory,
      commitmentContractFactory,
      config as DeciderConfig & PlasmaContractConfig,
      {}
    )
    aggregator.registerToken(
      Address.from(config.payoutContracts.DepositContract)
    )
  })

  test('deposit', async () => {
    // create ownership stateupdate
    const { decider } = aggregator
    const { coder } = ovmContext
    const depositContractAddress = Address.from(
      config.payoutContracts.DepositContract
    )
    const ownershipPredicate = decider.compiledPredicateMap.get(
      'Ownership'
    ) as CompiledPredicate
    const stateUpdate = new StateUpdate(
      depositContractAddress,
      new Range(BigNumber.from(0), BigNumber.from(10)),
      BigNumber.from(0),
      ownershipPredicate.makeProperty([coder.encode(ALIS_ADDRESS)])
    )
    const depositTx = new DepositTransaction(
      depositContractAddress,
      stateUpdate
    )
    await aggregator['stateManager'].insertDepositRange(
      depositTx,
      BigNumber.from(0)
    )

    const result = await aggregator['stateManager'].resolveStateUpdates(
      depositContractAddress,
      BigNumber.from(0),
      BigNumber.from(100)
    )
    expect(result.length).toBe(1)
    expect(result).toEqual([stateUpdate])
  })

  test('state transition', async () => {
    // create ownership stateupdate
    const { decider } = aggregator
    const { coder } = ovmContext
    const depositContractAddress = Address.from(
      config.payoutContracts.DepositContract
    )
    const ownershipPredicate = decider.compiledPredicateMap.get(
      'Ownership'
    ) as CompiledPredicate
    const stateUpdate = new StateUpdate(
      depositContractAddress,
      new Range(BigNumber.from(0), BigNumber.from(10)),
      BigNumber.from(0),
      ownershipPredicate.makeProperty([coder.encode(ALIS_ADDRESS)])
    )
    const depositTx = new DepositTransaction(
      depositContractAddress,
      stateUpdate
    )
    await aggregator['stateManager'].insertDepositRange(
      depositTx,
      BigNumber.from(0)
    )

    const nextStateObject = ownershipPredicate.makeProperty([
      coder.encode(BOB_ADDRESS)
    ])

    const tx = new Transaction(
      depositContractAddress,
      new Range(BigNumber.from(0), BigNumber.from(5)),
      BigNumber.from(5),
      nextStateObject,
      ALIS_ADDRESS
    )
    tx.signature = await ALIS_WALLET.signMessage(coder.encode(tx.body))

    const receipt = await aggregator['ingestTransaction'](tx)
    expect(receipt.status).toBe(TRANSACTION_STATUS.TRUE)

    const stateUpdates = await aggregator['stateManager'].resolveStateUpdates(
      depositContractAddress,
      BigNumber.from(0),
      BigNumber.from(100)
    )
    expect(stateUpdates.length).toBe(2)
    expect(stateUpdates).toEqual([
      new StateUpdate(
        depositContractAddress,
        new Range(BigNumber.from(0), BigNumber.from(5)),
        BigNumber.from(1),
        ownershipPredicate.makeProperty([coder.encode(BOB_ADDRESS)])
      ),
      new StateUpdate(
        depositContractAddress,
        new Range(BigNumber.from(5), BigNumber.from(10)),
        BigNumber.from(0),
        ownershipPredicate.makeProperty([coder.encode(ALIS_ADDRESS)])
      )
    ])
  })
})
