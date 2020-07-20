import { StateUpdate, Transaction, Block } from '@cryptoeconomicslab/plasma'
import {
  Address,
  Bytes,
  Range,
  BigNumber,
  Property
} from '@cryptoeconomicslab/primitives'
import { setupContext } from '@cryptoeconomicslab/context'
import Coder from '@cryptoeconomicslab/eth-coder'
import { KeyValueStore, putWitness } from '@cryptoeconomicslab/db'
import { InMemoryKeyValueStore } from '@cryptoeconomicslab/level-kvs'
import { DeciderManager, DeciderConfig } from '@cryptoeconomicslab/ovm'
import {
  StateUpdateRepository,
  TransactionRepository,
  InclusionProofRepository,
  SyncRepository
} from '../../src/repository'
import { generateRandomWallet } from '../helper/MockWallet'
import deciderConfig from '../config.local'
import { createSignatureHint } from '@cryptoeconomicslab/ovm/lib/hintString'
import { DoubleLayerInclusionProof } from '@cryptoeconomicslab/merkle-tree'
import { Wallet } from '@cryptoeconomicslab/wallet'
import { verifyCheckpoint } from '../../src/verifier/CheckpointVerifier'
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
    let suRepo: StateUpdateRepository,
      txRepo: TransactionRepository,
      inclusionProofRepo: InclusionProofRepository,
      syncRepo: SyncRepository

    beforeEach(async () => {
      suRepo = await StateUpdateRepository.init(witnessDb)
      txRepo = await TransactionRepository.init(witnessDb)
      inclusionProofRepo = await InclusionProofRepository.init(witnessDb)
      syncRepo = await SyncRepository.init(witnessDb)
    })

    // prepare StateUpdate, Transaction, Signature, InclusionProof and  BlockRoot
    async function prepareSU(su: StateUpdate) {
      const { blockNumber, range } = su
      await suRepo.insertWitnessStateUpdate(su)

      const suList = [su]
      const suMap = new Map<string, StateUpdate[]>()
      suMap.set(TOKEN_ADDRESS.data, suList)

      const block = new Block(blockNumber, suMap)
      const root = block.getRoot()
      const inclusionProof = block.getInclusionProof(
        su
      ) as DoubleLayerInclusionProof

      await syncRepo.insertBlockRoot(blockNumber, root)
      await inclusionProofRepo.insertInclusionProof(
        TOKEN_ADDRESS,
        blockNumber,
        range,
        inclusionProof
      )

      await inclusionProofRepo.insertInclusionProof(
        TOKEN_ADDRESS,
        blockNumber,
        range,
        inclusionProof
      )
    }

    async function prepareTx(
      su: StateUpdate,
      wallet: Wallet,
      nextOwner: Wallet
    ) {
      const { blockNumber, depositContractAddress, range } = su
      const tx = new Transaction(
        TOKEN_ADDRESS,
        range,
        BigNumber.from(100),
        ownershipSO(nextOwner.getAddress()),
        wallet.getAddress()
      )
      await txRepo.insertTransaction(
        depositContractAddress,
        blockNumber,
        range,
        tx
      )

      // save signature
      const txBytes = Coder.encode(tx.body)
      const sign = await wallet.signMessage(txBytes)
      await putWitness(witnessDb, createSignatureHint(txBytes), sign)
    }

    test('verifyCheckpoint returns true', async () => {
      const range = new Range(BigNumber.from(0), BigNumber.from(10))
      const su1 = SU(range, BigNumber.from(1), ALICE.getAddress())
      await prepareSU(su1)
      await prepareTx(su1, ALICE, BOB)

      const su2 = SU(range, BigNumber.from(2), BOB.getAddress())
      await prepareSU(su2)
      await prepareTx(su2, BOB, CHARLIE)

      const su3 = SU(range, BigNumber.from(3), CHARLIE.getAddress())

      const result = await verifyCheckpoint(witnessDb, deciderManager, su3)
      expect(result).toEqual({
        decision: true
      })
    })

    test('verifyCheckpoint returns false', async () => {
      const range = new Range(BigNumber.from(0), BigNumber.from(10))
      const su1 = SU(range, BigNumber.from(1), ALICE.getAddress())
      await prepareSU(su1)
      await prepareTx(su1, ALICE, BOB)

      const su2 = SU(range, BigNumber.from(2), BOB.getAddress())
      await prepareSU(su2)

      const su3 = SU(range, BigNumber.from(3), CHARLIE.getAddress())

      const result = await verifyCheckpoint(witnessDb, deciderManager, su3)
      expect(result).toEqual({
        decision: false,
        challenge: su2
      })
    })
  })
})
