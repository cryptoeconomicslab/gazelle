import { StateUpdate } from '@cryptoeconomicslab/plasma'
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
import { generateRandomWallet } from '../helper/MockWallet'
import deciderConfig from '../config.local'
import { Wallet } from '@cryptoeconomicslab/wallet'
import { verifyCheckpoint } from '../../src/verifier/CheckpointVerifier'
import * as Prepare from '../helper/prepare'
setupContext({ coder: Coder })

const TOKEN_ADDRESS = Address.default()
const SU_ADDRESS = Address.from('0x0000000000000000000000000000000000000001')
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
    // TODO: set constants table secp256k1
  })

  function ownershipSO(owner: Address) {
    return new Property(OWNERSHIP_ADDRESS, [Coder.encode(owner)])
  }

  function SU(range: Range, blockNumber: BigNumber, owner: Address) {
    return new StateUpdate(
      SU_ADDRESS,
      TOKEN_ADDRESS,
      range,
      blockNumber,
      ownershipSO(owner)
    )
  }

  describe('verifyCheckpoint', () => {
    // prepare StateUpdate, InclusionProof and  BlockRoot
    async function prepareSU(witnessDb: KeyValueStore, su: StateUpdate) {
      await Prepare.prepareSU(witnessDb, su)
      const block = await Prepare.prepareBlock(witnessDb, su)
      await Prepare.prepareInclusionProof(witnessDb, su, block)
    }

    // Tx, Signature
    async function prepareTx(
      witnessDb: KeyValueStore,
      su: StateUpdate,
      wallet: Wallet,
      nextOwner: Wallet
    ) {
      const tx = await Prepare.prepareTx(
        witnessDb,
        su,
        wallet,
        ownershipSO(nextOwner.getAddress())
      )
      await Prepare.prepareSignature(witnessDb, tx, wallet)
    }

    test('verifyCheckpoint returns true', async () => {
      const range = new Range(BigNumber.from(0), BigNumber.from(10))

      const su1 = SU(range, BigNumber.from(1), ALICE.getAddress())
      await prepareSU(witnessDb, su1)
      await prepareTx(witnessDb, su1, ALICE, BOB)

      const su2 = SU(range, BigNumber.from(2), BOB.getAddress())
      await prepareSU(witnessDb, su2)
      await prepareTx(witnessDb, su2, BOB, CHARLIE)

      const su3 = SU(range, BigNumber.from(3), CHARLIE.getAddress())

      const result = await verifyCheckpoint(witnessDb, deciderManager, su3)
      expect(result).toEqual({
        decision: true
      })
    })

    test('verifyCheckpoint returns false', async () => {
      const range = new Range(BigNumber.from(0), BigNumber.from(10))
      const su1 = SU(range, BigNumber.from(1), ALICE.getAddress())
      await prepareSU(witnessDb, su1)
      await prepareTx(witnessDb, su1, ALICE, BOB)

      const su2 = SU(range, BigNumber.from(2), BOB.getAddress())
      await prepareSU(witnessDb, su2)

      const su3 = SU(range, BigNumber.from(3), CHARLIE.getAddress())

      const result = await verifyCheckpoint(witnessDb, deciderManager, su3)
      expect(result).toEqual({
        decision: false,
        challenge: su2
      })
    })
  })
})
