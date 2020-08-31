import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.join(__dirname, '.test.env') })

import { StateUpdate, Block } from '@cryptoeconomicslab/plasma'
import { InMemoryKeyValueStore } from '@cryptoeconomicslab/level-kvs'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import {
  Address,
  Bytes,
  BigNumber,
  Range,
  Property,
  FixedBytes
} from '@cryptoeconomicslab/primitives'
import { EthCoder as Coder } from '@cryptoeconomicslab/eth-coder'
import { setupContext } from '@cryptoeconomicslab/context'
import config from './config.local'
setupContext({
  coder: Coder
})

import { BlockManager } from '../src/managers'
import { TransactionSubmitter } from '../src/TransactionSubmitter'

// Setup mock contract
const MockSubmit = jest.fn()

const MockCommitmentContract = jest
  .fn()
  .mockImplementation((addr: Address) => ({
    getCurrentBlock: () => BigNumber.from(0),
    submit: MockSubmit
  }))

const MockFailCommitmentContract = jest
  .fn()
  .mockImplementation((addr: Address) => {
    return {
      getCurrentBlock: () => BigNumber.from(0),
      submit: MockSubmit.mockRejectedValueOnce(
        new Error('revert')
      ).mockResolvedValueOnce({})
    }
  })

describe('Transaction Submitter', () => {
  const predicateAddress = Address.default()
  const depositContractAddress = Address.from(
    config.payoutContracts.DepositContract
  )

  let transactionSubmitter: TransactionSubmitter,
    blockDb: KeyValueStore,
    blockManager: BlockManager,
    kvs: KeyValueStore,
    stateUpdate: StateUpdate

  beforeEach(async () => {
    stateUpdate = new StateUpdate(
      depositContractAddress,
      new Range(BigNumber.from(0), BigNumber.from(10)),
      BigNumber.from(0),
      new Property(predicateAddress, []),
      FixedBytes.default(32)
    )

    kvs = new InMemoryKeyValueStore(Bytes.fromString('test-db'))
    blockDb = await kvs.bucket(Bytes.fromString('block'))
    blockManager = new BlockManager(blockDb)

    blockManager.registerToken(depositContractAddress)

    MockSubmit.mockClear()
  })

  describe('succeed to submit', () => {
    beforeEach(async () => {
      function commitmentContractFactory(address: Address) {
        return new MockCommitmentContract(address)
      }
      transactionSubmitter = new TransactionSubmitter(
        blockManager,
        commitmentContractFactory,
        config.commitment
      )
    })

    test('do not submit empty block', async () => {
      await transactionSubmitter.submit()
      expect(MockSubmit).toHaveBeenCalledTimes(0)
    })

    test('submit block', async () => {
      await blockManager.enqueuePendingStateUpdate(stateUpdate)
      await transactionSubmitter.submit()
      const block: Block = (await blockManager.getBlock(
        BigNumber.from(1)
      )) as Block
      const root = block.getRoot()
      expect(MockSubmit).toHaveBeenCalledTimes(1)
      expect(MockSubmit).toHaveBeenCalledWith(BigNumber.from(1), root)
    })
  })

  describe('retry submit', () => {
    beforeEach(async () => {
      function failCommitmentContractFactory(address: Address) {
        return new MockFailCommitmentContract(address)
      }
      transactionSubmitter = new TransactionSubmitter(
        blockManager,
        failCommitmentContractFactory,
        config.commitment
      )
    })
    test('submit failed and retry', async () => {
      await blockManager.enqueuePendingStateUpdate(stateUpdate)
      await transactionSubmitter.submit()
      await transactionSubmitter.submit()
      const block: Block = (await blockManager.getBlock(
        BigNumber.from(1)
      )) as Block
      const root = block.getRoot()

      expect(MockSubmit).toHaveBeenCalledTimes(2)
      expect(MockSubmit).toHaveBeenLastCalledWith(BigNumber.from(1), root)
    })
  })
})
