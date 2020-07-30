import { StateUpdate } from '@cryptoeconomicslab/plasma'
import { CheckpointDispute } from '../../src/dispute/CheckpointDispute'
import {
  Address,
  Bytes,
  Range,
  BigNumber,
  Property
} from '@cryptoeconomicslab/primitives'
import { setupContext } from '@cryptoeconomicslab/context'
import Coder from '@cryptoeconomicslab/eth-coder'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import { InMemoryKeyValueStore } from '@cryptoeconomicslab/level-kvs'
import { DeciderManager, DeciderConfig } from '@cryptoeconomicslab/ovm'
import APIClient from '../../src/APIClient'
import TokenManager from '../../src/managers/TokenManager'
import { generateRandomWallet } from '../helper/MockWallet'
import deciderConfig from '../config.local'
import { DoubleLayerInclusionProof } from '@cryptoeconomicslab/merkle-tree'
import { Wallet } from '@cryptoeconomicslab/wallet'
import {
  prepareValidSU,
  prepareValidTxAndSig,
  prepareBlock,
  prepareCheckpoint,
  prepareTx
} from '../helper/prepare'
setupContext({ coder: Coder })

const mockFunctions = {
  mockClaim: jest.fn(),
  mockChallenge: jest.fn(),
  mockRemoveChallenge: jest.fn(),
  mockSettle: jest.fn(),
  mockSubscribeCheckpointClaimed: jest.fn(),
  mockSubscribeCheckpointChallenged: jest.fn(),
  mockSubscribeCheckpointChallengeRemoved: jest.fn(),
  mockSubscribeCheckpointSettled: jest.fn()
}

const MockContractWrapper = jest.fn().mockImplementation(() => {
  return {
    claim: mockFunctions.mockClaim,
    challenge: mockFunctions.mockChallenge,
    removeChallenge: mockFunctions.mockRemoveChallenge,
    settle: mockFunctions.mockSettle,
    subscribeCheckpointClaimed: mockFunctions.mockSubscribeCheckpointClaimed,
    subscribeCheckpointChallenged:
      mockFunctions.mockSubscribeCheckpointChallenged,
    subscribeCheckpointChallengeRemoved:
      mockFunctions.mockSubscribeCheckpointChallengeRemoved,
    subscribeCheckpointSettled: mockFunctions.mockSubscribeCheckpointSettled
  }
})

function clearMocks() {
  MockContractWrapper.mockClear()
  Object.values(mockFunctions).forEach(mock => mock.mockClear())
}

const TOKEN_ADDRESS = Address.default()
const OWNERSHIP_ADDRESS = Address.from(
  deciderConfig.deployedPredicateTable.OwnershipPredicate.deployedAddress
)

describe('CheckpointDispute', () => {
  const ALICE = generateRandomWallet()
  const BOB = generateRandomWallet()
  const CHARLIE = generateRandomWallet()
  let checkpointDispute: CheckpointDispute
  let witnessDb: KeyValueStore
  let deciderManager: DeciderManager

  beforeEach(async () => {
    clearMocks()

    const apiClient = new APIClient('http://localhost:3000')
    const tokenManager = new TokenManager()

    // we only need depositContractAddresses in CheckpointDispute
    tokenManager.depositContractAddresses.push(TOKEN_ADDRESS)
    witnessDb = new InMemoryKeyValueStore(Bytes.fromString('test'))

    deciderManager = new DeciderManager(witnessDb, Coder)
    deciderManager.loadJson(deciderConfig as DeciderConfig)
    // TODO: set constants table secp256k1

    checkpointDispute = new CheckpointDispute(
      new MockContractWrapper(),
      witnessDb,
      deciderManager,
      tokenManager,
      apiClient
    )
  })

  function ownership(owner: Wallet) {
    return new Property(OWNERSHIP_ADDRESS, [Coder.encode(owner.getAddress())])
  }

  function SU(range: Range, blockNumber: BigNumber, owner: Wallet) {
    return new StateUpdate(TOKEN_ADDRESS, range, blockNumber, ownership(owner))
  }

  describe('handleCheckpointClaimed', () => {
    test('do not challenge irrelevant stateUpdate', async () => {
      const range = new Range(BigNumber.from(0), BigNumber.from(10))
      const range2 = new Range(BigNumber.from(15), BigNumber.from(20))

      const bn = BigNumber.from(1)
      const su1 = SU(range, bn, ALICE)
      const su2 = SU(range2, bn, BOB)

      const { block } = await prepareValidSU(witnessDb, su1)
      const inclusionProof = block.getInclusionProof(
        su2
      ) as DoubleLayerInclusionProof

      checkpointDispute.handleCheckpointClaimed(su2, inclusionProof)
      expect(mockFunctions.mockChallenge).not.toHaveBeenCalled()
    })

    test('do not challenge to relevant but older stateUpdate', async () => {
      const range = new Range(BigNumber.from(0), BigNumber.from(10))

      const bn = BigNumber.from(1)
      const su1 = SU(range, bn, ALICE)
      const bn2 = BigNumber.from(2)
      const su2 = SU(range, bn2, BOB)

      const { block } = await prepareValidSU(witnessDb, su1)
      await prepareValidSU(witnessDb, su2)

      const inclusionProof = block.getInclusionProof(
        su1
      ) as DoubleLayerInclusionProof

      checkpointDispute.handleCheckpointClaimed(su1, inclusionProof)
      expect(mockFunctions.mockChallenge).not.toHaveBeenCalled()
    })

    // TODO: mock APIClient
    test.skip('call challenge on contract with valid arguments', async () => {
      const range = new Range(BigNumber.from(0), BigNumber.from(10))

      const bn = BigNumber.from(1)
      const su1 = SU(range, bn, ALICE)
      await prepareValidSU(witnessDb, su1)
      await prepareValidTxAndSig(witnessDb, su1, ALICE, ownership(BOB))

      const bn2 = BigNumber.from(3)
      const su2 = SU(range, bn2, BOB)
      await prepareValidSU(witnessDb, su2)
      const block2 = await prepareBlock(witnessDb, su2)
      const inclusionProof2 = block2.getInclusionProof(
        su2
      ) as DoubleLayerInclusionProof

      const bn3 = BigNumber.from(4)
      const su3 = SU(range, bn3, CHARLIE)
      const block3 = await prepareBlock(witnessDb, su3)
      const inclusionProof3 = block3.getInclusionProof(
        su3
      ) as DoubleLayerInclusionProof

      await checkpointDispute.handleCheckpointClaimed(su3, inclusionProof3)
      expect(mockFunctions.mockChallenge).toHaveBeenCalledWith(
        su3,
        su2,
        inclusionProof2
      )
    })
  })

  describe('handleCheckpointChallenged', () => {
    test('do nothing for irrelevant claim challenged', async () => {
      const range = new Range(BigNumber.from(0), BigNumber.from(10))
      const bn = BigNumber.from(1)
      const su1 = SU(range, bn, ALICE)
      await prepareValidSU(witnessDb, su1)

      const bn2 = BigNumber.from(2)
      const su2 = SU(range, bn2, BOB)
      const block = await prepareBlock(witnessDb, su2)
      const inclusionProof = block.getInclusionProof(
        su2
      ) as DoubleLayerInclusionProof
      await checkpointDispute.handleCheckpointChallenged(
        su2,
        su1,
        inclusionProof
      )

      expect(mockFunctions.mockRemoveChallenge).not.toHaveBeenCalled()
    })

    test('do not call if transaction does not exist for challengingStateUpdate', async () => {
      const range = new Range(BigNumber.from(0), BigNumber.from(10))
      const bn = BigNumber.from(1)
      const su1 = SU(range, bn, ALICE)
      const { inclusionProof: inclusionProof1 } = await prepareValidSU(
        witnessDb,
        su1
      )

      const bn2 = BigNumber.from(2)
      const su2 = SU(range, bn2, BOB)
      await prepareValidSU(witnessDb, su2)
      await prepareCheckpoint(witnessDb, su2, BigNumber.from(3))

      await checkpointDispute.handleCheckpointChallenged(
        su2,
        su1,
        inclusionProof1
      )

      expect(mockFunctions.mockRemoveChallenge).not.toHaveBeenCalled()
    })

    test('do not call if signature does not exist for challengingStateUpdate', async () => {
      const range = new Range(BigNumber.from(0), BigNumber.from(10))
      const bn = BigNumber.from(1)
      const su1 = SU(range, bn, ALICE)
      const { inclusionProof: inclusionProof1 } = await prepareValidSU(
        witnessDb,
        su1
      )
      await prepareTx(witnessDb, su1, ALICE, ownership(BOB))

      const bn2 = BigNumber.from(2)
      const su2 = SU(range, bn2, BOB)
      await prepareValidSU(witnessDb, su2)
      await prepareCheckpoint(witnessDb, su2, BigNumber.from(3))

      await checkpointDispute.handleCheckpointChallenged(
        su2,
        su1,
        inclusionProof1
      )

      expect(mockFunctions.mockRemoveChallenge).not.toHaveBeenCalled()
    })

    test('call removeChallenge on contract with valid arguments', async () => {
      const range = new Range(BigNumber.from(0), BigNumber.from(10))
      const bn = BigNumber.from(1)
      const su1 = SU(range, bn, ALICE)
      const { inclusionProof: inclusionProof1 } = await prepareValidSU(
        witnessDb,
        su1
      )
      const { tx, sig } = await prepareValidTxAndSig(
        witnessDb,
        su1,
        ALICE,
        ownership(BOB)
      )

      const bn2 = BigNumber.from(2)
      const su2 = SU(range, bn2, BOB)
      await prepareValidSU(witnessDb, su2)
      await prepareCheckpoint(witnessDb, su2, BigNumber.from(3))

      await checkpointDispute.handleCheckpointChallenged(
        su2,
        su1,
        inclusionProof1
      )

      expect(mockFunctions.mockRemoveChallenge).toHaveBeenCalledWith(su2, su1, [
        tx.message,
        sig
      ])
    })
  })
})
