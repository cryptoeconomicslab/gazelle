import { StateUpdate } from '@cryptoeconomicslab/plasma'
import {
  Address,
  Bytes,
  Range,
  BigNumber,
  Property,
  FixedBytes
} from '@cryptoeconomicslab/primitives'
import { setupContext } from '@cryptoeconomicslab/context'
import Coder from '@cryptoeconomicslab/eth-coder'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import { InMemoryKeyValueStore } from '@cryptoeconomicslab/level-kvs'
import { DeciderManager, DeciderConfig } from '@cryptoeconomicslab/ovm'
import { generateRandomWallet } from '../helper/MockWallet'
import deciderConfig from '../config.local'
import { verifyCheckpoint } from '../../src/verifier/CheckpointVerifier'
import { prepareValidSU, prepareValidTxAndSig } from '../helper/prepare'
setupContext({ coder: Coder })

const TOKEN_ADDRESS = Address.default()
const OWNERSHIP_ADDRESS = Address.from(
  deciderConfig.deployedPredicateTable.OwnershipPredicate.deployedAddress
)

describe('CheckpointDispute', () => {
  const ALICE = generateRandomWallet()
  const BOB = generateRandomWallet()
  const CHARLIE = generateRandomWallet()
  let witnessDb: KeyValueStore
  let deciderManager: DeciderManager

  beforeEach(async () => {
    // we only need depositContractAddresses in CheckpointDispute
    witnessDb = new InMemoryKeyValueStore(Bytes.fromString('test'))

    deciderManager = new DeciderManager(witnessDb, Coder)
    deciderManager.loadJson(deciderConfig as DeciderConfig)
  })

  function ownershipSO(owner: Address) {
    return new Property(OWNERSHIP_ADDRESS, [Coder.encode(owner)])
  }

  function SU(range: Range, blockNumber: BigNumber, owner: Address) {
    return new StateUpdate(
      TOKEN_ADDRESS,
      range,
      blockNumber,
      ownershipSO(owner),
      FixedBytes.default(32)
    )
  }

  describe('verifyCheckpoint', () => {
    test('verifyCheckpoint returns true', async () => {
      const range = new Range(BigNumber.from(0), BigNumber.from(10))

      const su1 = SU(range, BigNumber.from(1), ALICE.getAddress())
      await prepareValidSU(witnessDb, su1)
      await prepareValidTxAndSig(
        witnessDb,
        su1,
        ALICE,
        ownershipSO(BOB.getAddress())
      )

      const su2 = SU(range, BigNumber.from(2), BOB.getAddress())
      await prepareValidSU(witnessDb, su2)
      await prepareValidTxAndSig(
        witnessDb,
        su2,
        BOB,
        ownershipSO(CHARLIE.getAddress())
      )

      const su3 = SU(range, BigNumber.from(3), CHARLIE.getAddress())

      const result = await verifyCheckpoint(witnessDb, deciderManager, su3)
      expect(result).toEqual({
        decision: true
      })
    })

    test('verifyCheckpoint returns false', async () => {
      const range = new Range(BigNumber.from(0), BigNumber.from(10))
      const su1 = SU(range, BigNumber.from(1), ALICE.getAddress())
      await prepareValidSU(witnessDb, su1)
      await prepareValidTxAndSig(
        witnessDb,
        su1,
        ALICE,
        ownershipSO(BOB.getAddress())
      )

      const su2 = SU(range, BigNumber.from(2), BOB.getAddress())
      await prepareValidSU(witnessDb, su2)

      const su3 = SU(range, BigNumber.from(3), CHARLIE.getAddress())

      const result = await verifyCheckpoint(witnessDb, deciderManager, su3)
      expect(result).toEqual({
        decision: false,
        challenge: su2
      })
    })
  })
})
