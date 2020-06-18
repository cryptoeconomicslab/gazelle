import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.join(__dirname, '.test.env') })

import Aggregator from '../../src/Aggregator'
import { Block, PlasmaContractConfig } from '@cryptoeconomicslab/plasma'
import { InMemoryKeyValueStore } from '@cryptoeconomicslab/level-kvs'
import { RangeDb, KeyValueStore } from '@cryptoeconomicslab/db'
import { DeciderConfig } from '@cryptoeconomicslab/ovm'
import { Address, Bytes, BigNumber } from '@cryptoeconomicslab/primitives'
import { EthCoder as Coder } from '@cryptoeconomicslab/eth-coder'
import { Balance } from '@cryptoeconomicslab/wallet'
import {
  Secp256k1Signer,
  secp256k1Verifier
} from '@cryptoeconomicslab/signature'
import { setupContext } from '@cryptoeconomicslab/context'
import config from '../config.local'
setupContext({
  coder: Coder
})

import { BlockManager, StateManager } from '../../src/managers'
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

export async function initializeAggregatorWithBlocks(
  blocks: Block[],
  currentBlockNumber: BigNumber
): Promise<Aggregator> {
  const kvs = new InMemoryKeyValueStore(Bytes.fromString('test-db'))
  const stateBucket = await kvs.bucket(Bytes.fromString('state_update'))
  const stateDb = new RangeDb(stateBucket)
  const blockDb = await kvs.bucket(Bytes.fromString('block'))
  const stateManager = new StateManager(stateDb)
  const blockManager = new BlockManager(blockDb)
  const witnessDb = await kvs.bucket(Bytes.fromString('witness'))
  const eventDb = await kvs.bucket(Bytes.fromString('event'))
  const wallet = new MockWallet()

  for (const block of blocks) {
    await blockManager.putBlock(block)
  }
  await blockManager['setBlockNumber'](currentBlockNumber)

  function depositContractFactory(address: Address) {
    return new MockDepositContract(address, eventDb)
  }
  function commitmentContractFactory(address: Address) {
    return new MockCommitmentContract(address, eventDb)
  }
  const aggregator = new Aggregator(
    wallet,
    stateManager,
    blockManager,
    witnessDb,
    depositContractFactory,
    commitmentContractFactory,
    config as DeciderConfig & PlasmaContractConfig,
    {}
  )
  aggregator.registerToken(Address.from(config.payoutContracts.DepositContract))
  return aggregator
}
