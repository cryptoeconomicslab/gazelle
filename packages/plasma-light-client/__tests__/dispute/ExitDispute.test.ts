import { ExitDispute } from '../../src/dispute/ExitDispute'
import { InMemoryKeyValueStore } from '@cryptoeconomicslab/level-kvs'
import {
  Bytes,
  Address,
  BigNumber,
  Range,
  Property
} from '@cryptoeconomicslab/primitives'
import {
  StateUpdate,
  Transaction,
  Block,
  EXIT_CHALLENGE_TYPE
} from '@cryptoeconomicslab/plasma'
import { setupContext } from '@cryptoeconomicslab/context'
import JsonCoder from '@cryptoeconomicslab/coder'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import {
  TransactionRepository,
  InclusionProofRepository
} from '../../src/repository'
import { DoubleLayerInclusionProof } from '@cryptoeconomicslab/merkle-tree'
setupContext({ coder: JsonCoder })

const mockClaim = jest.fn().mockImplementation(() => {})
const mockClaimFailing = jest.fn().mockImplementation(() => {
  throw new Error('revert: invalid inputs')
})
const mockChallenge = jest.fn().mockImplementation(() => {})
const mockSubscribeExitClaim = jest.fn()
const mockSubscribeExitChallenged = jest.fn()
const mockSubscribeExitSettled = jest.fn()

const MockContractWrapper = jest.fn().mockImplementation(() => {
  return {
    claim: mockClaim,
    challenge: mockChallenge,
    subscribeExitClaimed: mockSubscribeExitClaim,
    subscribeExitChallenged: mockSubscribeExitChallenged,
    subscribeExitSettled: mockSubscribeExitSettled
  }
})

const MockContractWrapperFailing = jest.fn().mockImplementation(() => {
  return {
    claim: mockClaimFailing,
    challenge: mockChallenge,
    subscribeExitClaimed: mockSubscribeExitClaim,
    subscribeExitChallenged: mockSubscribeExitChallenged,
    subscribeExitSettled: mockSubscribeExitSettled
  }
})

const mockDecideFalse = jest.fn().mockResolvedValue({ outcome: false })
const mockDecideTrue = jest
  .fn()
  .mockResolvedValue({ outcome: true, witnesses: [] })
const MockDeciderManager = jest
  .fn()
  .mockImplementation((mockDecide = mockDecideFalse) => {
    return {
      decide: mockDecide
    }
  })

const depositContractAddress = Address.from(
  '0x0000000000000000000000000000000000000001'
)
const range = new Range(BigNumber.from(0), BigNumber.from(10))
const maxBlockNumber = BigNumber.from(10)
const ownershipPredicateAddress = Address.from(
  '0x0000000000000000000000000000000000000002'
)
const owner = Address.from('0x0000000000000000000000000000000000000003')
const ownershipState = new Property(ownershipPredicateAddress, [
  ovmContext.coder.encode(owner)
])
const stateUpdateDeciderAddress = Address.from(
  '0x0000000000000000000000000000000000000004'
)
const stateUpdate = new StateUpdate(
  stateUpdateDeciderAddress,
  depositContractAddress,
  range,
  maxBlockNumber,
  ownershipState
)

describe('ExitDispute', () => {
  beforeEach(() => {
    MockContractWrapper.mockClear()
    MockDeciderManager.mockClear()
  })

  async function prepareInclusionProof(
    witnessDb: KeyValueStore,
    stateUpdate: StateUpdate
  ) {
    const map = new Map()
    map.set(stateUpdate.depositContractAddress.data, [stateUpdate])

    const block = new Block(stateUpdate.blockNumber, map)
    const repo = await InclusionProofRepository.init(witnessDb)
    const inclusionProof = block.getInclusionProof(
      stateUpdate
    ) as DoubleLayerInclusionProof

    await repo.insertInclusionProof(
      stateUpdate.depositContractAddress,
      stateUpdate.blockNumber,
      stateUpdate.range,
      inclusionProof
    )
  }

  function createTransaction(stateUpdate: StateUpdate) {
    const depositContractAddress = stateUpdate.depositContractAddress
    const range = stateUpdate.range
    const maxBlockNumber = BigNumber.from(100)
    const ownershipPredicateAddress = Address.from(
      '0x0000000000000000000000000000000000000002'
    )
    const owner = Address.from('0x0000000000000000000000000000000000000003')
    const ownershipState = new Property(ownershipPredicateAddress, [
      ovmContext.coder.encode(owner)
    ])
    const from = Address.from('0x0000000000000000000000000000000000000004')
    return new Transaction(
      depositContractAddress,
      range,
      maxBlockNumber,
      ownershipState,
      from
    )
  }

  async function prepareTransaction(
    witnessDb: KeyValueStore,
    stateUpdate: StateUpdate,
    transaction: Transaction
  ) {
    const txRepo = await TransactionRepository.init(witnessDb)
    await txRepo.insertTransaction(
      stateUpdate.depositContractAddress,
      stateUpdate.blockNumber,
      stateUpdate.range,
      transaction
    )
  }

  describe('claimExit', () => {
    test('succeed', async () => {
      const witnessDb = new InMemoryKeyValueStore(Bytes.fromString('test'))
      await prepareInclusionProof(witnessDb, stateUpdate)
      const exitDispute = new ExitDispute(
        new MockContractWrapper(),
        new MockDeciderManager(),
        witnessDb
      )
      await exitDispute.claimExit(stateUpdate)
    })

    test('throw exception because of invalid StateUpdate range', async () => {
      const witnessDb = new InMemoryKeyValueStore(Bytes.fromString('test'))
      const exitDispute = new ExitDispute(
        new MockContractWrapper(),
        new MockDeciderManager(),
        witnessDb
      )
      await expect(exitDispute.claimExit(stateUpdate)).rejects.toThrow()
    })

    test('throw exception because of transaction revert', async () => {
      const witnessDb = new InMemoryKeyValueStore(Bytes.fromString('test'))
      await prepareInclusionProof(witnessDb, stateUpdate)
      const exitDispute = new ExitDispute(
        new MockContractWrapperFailing(),
        new MockDeciderManager(),
        witnessDb
      )
      await expect(exitDispute.claimExit(stateUpdate)).rejects.toThrowError(
        'revert: invalid inputs'
      )
    })
  })

  describe('handleExitClaimed', () => {
    test('do nothing because transactions are not exists', async () => {
      const witnessDb = new InMemoryKeyValueStore(Bytes.fromString('test'))
      const exitDispute = new ExitDispute(
        new MockContractWrapper(),
        new MockDeciderManager(),
        witnessDb
      )
      await exitDispute.handleExitClaimed(stateUpdate)
    })

    test('do nothing because decision of StateObject is false', async () => {
      const witnessDb = new InMemoryKeyValueStore(Bytes.fromString('test'))
      const tx = createTransaction(stateUpdate)
      await prepareTransaction(witnessDb, stateUpdate, tx)
      const exitDispute = new ExitDispute(
        new MockContractWrapper(),
        new MockDeciderManager(),
        witnessDb
      )
      await exitDispute.handleExitClaimed(stateUpdate)
    })

    test('challenge receiving exit', async () => {
      const witnessDb = new InMemoryKeyValueStore(Bytes.fromString('test'))
      const tx = createTransaction(stateUpdate)
      await prepareTransaction(witnessDb, stateUpdate, tx)
      const exitDispute = new ExitDispute(
        new MockContractWrapper(),
        new MockDeciderManager(mockDecideTrue),
        witnessDb
      )
      await exitDispute.handleExitClaimed(stateUpdate)

      // confirm challenge was executed
      expect(mockChallenge).toHaveBeenCalledWith({
        type: EXIT_CHALLENGE_TYPE.SPENT,
        stateUpdate,
        transaction: tx,
        witness: []
      })
    })
  })
})
