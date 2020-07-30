import { ExitDispute } from '../../src/dispute/ExitDispute'
import { InMemoryKeyValueStore } from '@cryptoeconomicslab/level-kvs'
import {
  Bytes,
  Address,
  BigNumber,
  Range,
  Property
} from '@cryptoeconomicslab/primitives'
import { StateUpdate, EXIT_CHALLENGE_TYPE } from '@cryptoeconomicslab/plasma'
import { setupContext } from '@cryptoeconomicslab/context'
import Coder from '@cryptoeconomicslab/eth-coder'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import {
  prepareSU,
  prepareBlock,
  prepareInclusionProof,
  prepareCheckpoint,
  prepareExit,
  prepareTx,
  prepareValidSU,
  prepareValidTxAndSig
} from '../helper/prepare'
import { generateRandomWallet } from '../helper/MockWallet'
import { DeciderManager, DeciderConfig } from '@cryptoeconomicslab/ovm'
import { Wallet } from '@cryptoeconomicslab/wallet'
import deciderConfig from '../config.local'
setupContext({ coder: Coder })

const mockFunctions = {
  mockClaim: jest.fn(),
  mockChallenge: jest.fn(),
  mockRemoveChallenge: jest.fn(),
  mockSettle: jest.fn(),
  mockSubscribeExitClaim: jest.fn(),
  mockSubscribeExitChallenged: jest.fn(),
  mockSubscribeExitSettled: jest.fn()
}

const MockContractWrapper = jest.fn().mockImplementation(() => {
  return {
    claim: mockFunctions.mockClaim,
    challenge: mockFunctions.mockChallenge,
    removeChallenge: mockFunctions.mockRemoveChallenge,
    subscribeExitClaimed: mockFunctions.mockSubscribeExitClaim,
    subscribeExitChallenged: mockFunctions.mockSubscribeExitChallenged,
    subscribeExitSettled: mockFunctions.mockSubscribeExitSettled
  }
})

function clearMocks() {
  MockContractWrapper.mockClear()
  Object.values(mockFunctions).forEach(mock => mock.mockClear())
}

const depositContractAddress = Address.from(
  '0x0000000000000000000000000000000000000001'
)
const range = new Range(BigNumber.from(0), BigNumber.from(10))
const blockNumber = BigNumber.from(1)
const ownershipPredicateAddress = Address.from(
  deciderConfig.deployedPredicateTable.OwnershipPredicate.deployedAddress
)

describe('ExitDispute', () => {
  const ALICE = generateRandomWallet()
  const BOB = generateRandomWallet()
  const CHARLIE = generateRandomWallet()

  let exitDispute: ExitDispute, witnessDb: KeyValueStore
  let deciderManager: DeciderManager

  beforeEach(() => {
    clearMocks()
    witnessDb = new InMemoryKeyValueStore(Bytes.fromString('test'))
    deciderManager = new DeciderManager(witnessDb)
    deciderManager.loadJson(deciderConfig as DeciderConfig)
    exitDispute = new ExitDispute(
      new MockContractWrapper(),
      witnessDb,
      deciderManager
    )
  })

  function ownership(owner: Wallet): Property {
    return new Property(ownershipPredicateAddress, [
      ovmContext.coder.encode(owner.getAddress())
    ])
  }

  function SU(range: Range, blockNumber: BigNumber, owner: Wallet) {
    return new StateUpdate(
      depositContractAddress,
      range,
      blockNumber,
      ownership(owner)
    )
  }

  describe('claimExit', () => {
    test('succeed', async () => {
      const stateUpdate = SU(range, blockNumber, ALICE)
      await prepareSU(witnessDb, stateUpdate)
      const block = await prepareBlock(witnessDb, stateUpdate)
      await prepareInclusionProof(witnessDb, stateUpdate, block)
      await exitDispute.claimExit(stateUpdate)
    })

    test('throw exception because of invalid StateUpdate range', async () => {
      const stateUpdate = SU(range, blockNumber, ALICE)
      await expect(exitDispute.claimExit(stateUpdate)).rejects.toThrow()
    })
  })

  describe('handleExitClaimed', () => {
    test('do nothing because transactions are not exists', async () => {
      const stateUpdate = SU(range, blockNumber, ALICE)
      await prepareSU(witnessDb, stateUpdate)
      await exitDispute.handleExitClaimed(stateUpdate)
    })

    test('do nothing because decision of StateObject is false', async () => {
      const stateUpdate = SU(range, blockNumber, ALICE)
      await prepareSU(witnessDb, stateUpdate)
      await prepareTx(witnessDb, stateUpdate, ALICE, ownership(BOB))
      await exitDispute.handleExitClaimed(stateUpdate)
    })

    // Trying to exit already spent StateUpdate
    test('spentChallenge', async () => {
      const stateUpdate = SU(range, blockNumber, ALICE)
      await prepareValidSU(witnessDb, stateUpdate)
      const { tx, sig } = await prepareValidTxAndSig(
        witnessDb,
        stateUpdate,
        ALICE,
        ownership(BOB)
      )
      await exitDispute.handleExitClaimed(stateUpdate)

      // confirm challenge was executed
      expect(mockFunctions.mockChallenge).toHaveBeenCalledWith({
        type: EXIT_CHALLENGE_TYPE.SPENT,
        stateUpdate,
        transaction: tx,
        witness: [sig]
      })
    })

    // old state update have not been properly spent
    test('checkpointChallenge', async () => {
      const range = new Range(BigNumber.from(0), BigNumber.from(10))
      const su1 = SU(range, BigNumber.from(1), ALICE)
      await prepareValidSU(witnessDb, su1)
      await prepareValidTxAndSig(witnessDb, su1, ALICE, ownership(BOB))
      const su2 = SU(range, BigNumber.from(2), BOB)
      const { inclusionProof } = await prepareValidSU(witnessDb, su2)

      const su3 = SU(range, BigNumber.from(3), CHARLIE)
      // su2 have not been spent
      await exitDispute.handleExitClaimed(su3)

      // confirm challenge was executed
      expect(mockFunctions.mockChallenge).toHaveBeenCalledWith({
        type: EXIT_CHALLENGE_TYPE.CHECKPOINT,
        stateUpdate: su3,
        challengeStateUpdate: su2,
        inclusionProof
      })
    })
  })

  describe('handleExitChallenged', () => {
    test('do nothing for SPENT challenge', async () => {
      const range = new Range(BigNumber.from(0), BigNumber.from(10))
      const su = SU(range, BigNumber.from(1), ALICE)
      await prepareValidTxAndSig(witnessDb, su, ALICE, ownership(BOB))

      exitDispute.handleExitChallenged(EXIT_CHALLENGE_TYPE.SPENT, su)
      expect(mockFunctions.mockChallenge).not.toHaveBeenCalled()
    })

    describe('Checkpoint challenge', () => {
      test('do nothing for irrelevant claim challenged', async () => {
        const range = new Range(BigNumber.from(0), BigNumber.from(10))
        const bn = BigNumber.from(1)
        const su1 = SU(range, bn, ALICE)
        await prepareValidSU(witnessDb, su1)

        const bn2 = BigNumber.from(2)
        const su2 = SU(range, bn2, BOB)
        await exitDispute.handleExitChallenged(
          EXIT_CHALLENGE_TYPE.CHECKPOINT,
          su2,
          su1
        )

        expect(mockFunctions.mockRemoveChallenge).not.toHaveBeenCalled()
      })

      test('do not call if transaction does not exist for challengingStateUpdate', async () => {
        const range = new Range(BigNumber.from(0), BigNumber.from(10))
        const bn = BigNumber.from(1)
        const su1 = SU(range, bn, ALICE)
        await prepareValidSU(witnessDb, su1)

        const bn2 = BigNumber.from(2)
        const su2 = SU(range, bn2, BOB)
        await prepareValidSU(witnessDb, su2)
        await prepareCheckpoint(witnessDb, su2, BigNumber.from(3))

        await exitDispute.handleExitChallenged(
          EXIT_CHALLENGE_TYPE.CHECKPOINT,
          su2,
          su1
        )

        expect(mockFunctions.mockRemoveChallenge).not.toHaveBeenCalled()
      })

      test('do not call if signature does not exist for challengingStateUpdate', async () => {
        const range = new Range(BigNumber.from(0), BigNumber.from(10))
        const bn = BigNumber.from(1)
        const su1 = SU(range, bn, ALICE)
        await prepareValidSU(witnessDb, su1)
        await prepareTx(witnessDb, su1, ALICE, ownership(BOB))

        const bn2 = BigNumber.from(2)
        const su2 = SU(range, bn2, BOB)
        await prepareValidSU(witnessDb, su2)
        await prepareCheckpoint(witnessDb, su2, BigNumber.from(3))

        await exitDispute.handleExitChallenged(
          EXIT_CHALLENGE_TYPE.CHECKPOINT,
          su2,
          su1
        )

        expect(mockFunctions.mockRemoveChallenge).not.toHaveBeenCalled()
      })

      test('call removeChallenge on contract with valid arguments', async () => {
        const range = new Range(BigNumber.from(0), BigNumber.from(10))
        const bn = BigNumber.from(1)
        const su1 = SU(range, bn, ALICE)
        await prepareValidSU(witnessDb, su1)
        const { tx, sig } = await prepareValidTxAndSig(
          witnessDb,
          su1,
          ALICE,
          ownership(BOB)
        )

        const bn2 = BigNumber.from(2)
        const su2 = SU(range, bn2, BOB)
        await prepareValidSU(witnessDb, su2)
        await prepareExit(witnessDb, su2, BigNumber.from(3))

        await exitDispute.handleExitChallenged(
          EXIT_CHALLENGE_TYPE.CHECKPOINT,
          su2,
          su1
        )

        expect(mockFunctions.mockRemoveChallenge).toHaveBeenCalledWith(
          su2,
          su1,
          [tx.message, sig]
        )
      })
    })
  })
})
