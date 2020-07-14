import { StateUpdate } from '@cryptoeconomicslab/plasma'
import { CheckpointDispute } from '../../src/dispute/CheckpointDispute'
import {
  Address,
  Bytes,
  Range,
  BigNumber
} from '@cryptoeconomicslab/primitives'
import { Property } from '@cryptoeconomicslab/ovm'
import { setupContext } from '@cryptoeconomicslab/context'
import Coder from '@cryptoeconomicslab/coder'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import { InMemoryKeyValueStore } from '@cryptoeconomicslab/level-kvs'
setupContext({ coder: Coder })

const mockClaim = jest.fn()
const mockChallenge = jest.fn()
const mockRemoveChallenge = jest.fn()
const mockSettle = jest.fn()
const mockSubscribeCheckpointClaimed = jest.fn()
const mockSubscribeCheckpointChallenged = jest.fn()
const mockSubscribeCheckpointChallengeRemoved = jest.fn()
const mockSubscribeCheckpointSettled = jest.fn()

const MockContractWrapper = jest.fn().mockImplementation(() => {
  return {
    claim: mockClaim,
    challenge: mockChallenge,
    removeChallenge: mockRemoveChallenge,
    settle: mockSettle,
    subscribeCheckpointClaimed: mockSubscribeCheckpointClaimed,
    subscribeCheckpointChallenged: mockSubscribeCheckpointChallenged,
    subscribeCheckpointChallengeRemoved: mockSubscribeCheckpointChallengeRemoved,
    subscribeCheckpointSettled: mockSubscribeCheckpointSettled
  }
})

const TOKEN_ADDRESS = Address.default()
const SU_ADDRESS = Address.from('0x0000000000000000000000000000000000000001')
const OWNERSHIP_ADDRESS = Address.from(
  '0x0000000000000000000000000000000000000002'
)

describe('CheckpointDispute', () => {
  const ALICE = Address.from('0x0000000000000000000000000000000000000003')
  let checkpointDispute: CheckpointDispute
  let witnessDb: KeyValueStore

  beforeEach(async () => {
    witnessDb = new InMemoryKeyValueStore(Bytes.fromString('test'))
    checkpointDispute = new CheckpointDispute(
      new MockContractWrapper(),
      witnessDb
    )
  })

  function ownershipSO(owner: Address) {
    return new Property(OWNERSHIP_ADDRESS, [Coder.encode(owner)])
  }
  function SU(start: number, end: number, blockNumber: number, owner: Address) {
    return new StateUpdate(
      SU_ADDRESS,
      TOKEN_ADDRESS,
      new Range(BigNumber.from(start), BigNumber.from(end)),
      BigNumber.from(blockNumber),
      ownershipSO(owner)
    )
  }

  describe('evaluate', () => {
    test('evaluate to true', async () => {
      const stateUpdate = SU(0, 10, 5, ALICE)

      const result = await checkpointDispute.evaluate(stateUpdate)

      expect(result).toEqual({
        decision: true
      })
    })
  })
})
