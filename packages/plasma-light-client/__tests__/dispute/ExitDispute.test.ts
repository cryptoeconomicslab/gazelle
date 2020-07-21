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
import * as Prepare from '../helper/prepare'
import { generateRandomWallet } from '../helper/MockWallet'
import { DeciderManager, DeciderConfig } from '@cryptoeconomicslab/ovm'
import { Wallet } from '@cryptoeconomicslab/wallet'
import deciderConfig from '../config.local'
setupContext({ coder: Coder })

const mockClaim = jest.fn().mockImplementation(() => {})
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

const depositContractAddress = Address.from(
  '0x0000000000000000000000000000000000000001'
)
const range = new Range(BigNumber.from(0), BigNumber.from(10))
const blockNumber = BigNumber.from(1)
const ownershipPredicateAddress = Address.from(
  deciderConfig.deployedPredicateTable.OwnershipPredicate.deployedAddress
)
const stateUpdateDeciderAddress = Address.from(
  '0x0000000000000000000000000000000000000004'
)

describe('ExitDispute', () => {
  const ALICE = generateRandomWallet()
  const BOB = generateRandomWallet()
  const CHARLIE = generateRandomWallet()

  let exitDispute: ExitDispute, witnessDb: KeyValueStore
  let deciderManager: DeciderManager

  beforeEach(() => {
    MockContractWrapper.mockClear()
    witnessDb = new InMemoryKeyValueStore(Bytes.fromString('test'))
    deciderManager = new DeciderManager(witnessDb)
    deciderManager.loadJson(deciderConfig as DeciderConfig)
    exitDispute = new ExitDispute(
      new MockContractWrapper(),
      deciderManager,
      witnessDb
    )
  })

  function ownership(owner: Wallet): Property {
    return new Property(ownershipPredicateAddress, [
      ovmContext.coder.encode(owner.getAddress())
    ])
  }

  function SU(range: Range, blockNumber: BigNumber, owner: Wallet) {
    return new StateUpdate(
      stateUpdateDeciderAddress,
      depositContractAddress,
      range,
      blockNumber,
      ownership(owner)
    )
  }

  describe('claimExit', () => {
    test('succeed', async () => {
      const stateUpdate = SU(range, blockNumber, ALICE)
      await Prepare.prepareSU(witnessDb, stateUpdate)
      const block = await Prepare.prepareBlock(witnessDb, stateUpdate)
      await Prepare.prepareInclusionProof(witnessDb, stateUpdate, block)
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
      await Prepare.prepareSU(witnessDb, stateUpdate)
      await exitDispute.handleExitClaimed(stateUpdate)
    })

    test('do nothing because decision of StateObject is false', async () => {
      const stateUpdate = SU(range, blockNumber, ALICE)
      await Prepare.prepareSU(witnessDb, stateUpdate)
      await Prepare.prepareTx(witnessDb, stateUpdate, ALICE, ownership(BOB))
      await exitDispute.handleExitClaimed(stateUpdate)
    })

    // Trying to exit already spent StateUpdate
    test('spentChallenge', async () => {
      const stateUpdate = SU(range, blockNumber, ALICE)
      await Prepare.prepareValidSU(witnessDb, stateUpdate)
      const { tx, sig } = await Prepare.prepareValidTxAndSig(
        witnessDb,
        stateUpdate,
        ALICE,
        ownership(BOB)
      )
      await exitDispute.handleExitClaimed(stateUpdate)

      // confirm challenge was executed
      expect(mockChallenge).toHaveBeenCalledWith({
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
      await Prepare.prepareValidSU(witnessDb, su1)
      await Prepare.prepareValidTxAndSig(witnessDb, su1, ALICE, ownership(BOB))
      const su2 = SU(range, BigNumber.from(2), BOB)
      const { inclusionProof } = await Prepare.prepareValidSU(witnessDb, su2)

      const su3 = SU(range, BigNumber.from(3), CHARLIE)
      // su2 have not been spent
      await exitDispute.handleExitClaimed(su3)

      // confirm challenge was executed
      expect(mockChallenge).toHaveBeenCalledWith({
        type: EXIT_CHALLENGE_TYPE.CHECKPOINT,
        stateUpdate: su3,
        challengeStateUpdate: su2,
        inclusionProof
      })
    })
  })
})
