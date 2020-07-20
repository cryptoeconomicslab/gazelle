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
import { InclusionProofRepository } from '../../src/repository'
import { DoubleLayerInclusionProof } from '@cryptoeconomicslab/merkle-tree'
import * as Prepare from '../helper/prepare'
import { generateRandomWallet } from '../helper/MockWallet'
import { Wallet } from '@cryptoeconomicslab/wallet'
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
const owner = generateRandomWallet()
const ownershipState = new Property(ownershipPredicateAddress, [
  ovmContext.coder.encode(owner.getAddress())
])
const nextOwner = generateRandomWallet()
const nextOwnership = new Property(ownershipPredicateAddress, [
  ovmContext.coder.encode(nextOwner.getAddress())
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
  let exitDispute: ExitDispute, witnessDb: KeyValueStore

  beforeEach(() => {
    MockContractWrapper.mockClear()
    MockDeciderManager.mockClear()
    witnessDb = new InMemoryKeyValueStore(Bytes.fromString('test'))
    exitDispute = new ExitDispute(
      new MockContractWrapper(),
      new MockDeciderManager(),
      witnessDb
    )
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

  function createTransaction(
    stateUpdate: StateUpdate,
    from: Wallet,
    to: Wallet
  ) {
    const depositContractAddress = stateUpdate.depositContractAddress
    const range = stateUpdate.range
    const maxBlockNumber = BigNumber.from(100)
    const ownershipPredicateAddress = Address.from(
      '0x0000000000000000000000000000000000000002'
    )
    const nextState = new Property(ownershipPredicateAddress, [
      ovmContext.coder.encode(to.getAddress())
    ])
    return new Transaction(
      depositContractAddress,
      range,
      maxBlockNumber,
      nextState,
      from.getAddress()
    )
  }

  describe('claimExit', () => {
    test('succeed', async () => {
      await prepareInclusionProof(witnessDb, stateUpdate)
      await exitDispute.claimExit(stateUpdate)
    })

    test('throw exception because of invalid StateUpdate range', async () => {
      await expect(exitDispute.claimExit(stateUpdate)).rejects.toThrow()
    })

    test('throw exception because of transaction revert', async () => {
      await prepareInclusionProof(witnessDb, stateUpdate)
      exitDispute = new ExitDispute(
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
      await Prepare.prepareSU(witnessDb, stateUpdate)
      await exitDispute.handleExitClaimed(stateUpdate)
    })

    test('do nothing because decision of StateObject is false', async () => {
      await Prepare.prepareSU(witnessDb, stateUpdate)
      await Prepare.prepareTx(witnessDb, stateUpdate, owner, nextOwnership)
      await exitDispute.handleExitClaimed(stateUpdate)
    })

    test('spentChallenge', async () => {
      await Prepare.prepareSU(witnessDb, stateUpdate)
      exitDispute = new ExitDispute(
        new MockContractWrapper(),
        new MockDeciderManager(mockDecideTrue),
        witnessDb
      )

      const tx = createTransaction(stateUpdate, owner, nextOwner)
      await Prepare.prepareTx(witnessDb, stateUpdate, owner, nextOwnership)
      await exitDispute.handleExitClaimed(stateUpdate)

      // confirm challenge was executed
      expect(mockChallenge).toHaveBeenCalledWith({
        type: EXIT_CHALLENGE_TYPE.SPENT,
        stateUpdate,
        transaction: tx,
        witness: []
      })
    })

    // old state update have not been properly spent
    test('checkpointChallenge', async () => {
      await Prepare.prepareSU(witnessDb, stateUpdate)
      exitDispute = new ExitDispute(
        new MockContractWrapper(),
        new MockDeciderManager(mockDecideTrue),
        witnessDb
      )

      const tx = createTransaction(stateUpdate, owner, nextOwner)
      await Prepare.prepareTx(witnessDb, stateUpdate, owner, nextOwnership)
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
