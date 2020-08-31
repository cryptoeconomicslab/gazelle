import {
  FixedBytes,
  Bytes,
  BigNumber,
  Property
} from '@cryptoeconomicslab/primitives'
import { KeyValueStore, putWitness } from '@cryptoeconomicslab/db'
import {
  StateUpdate,
  UnsignedTransaction,
  SignedTransaction,
  Block,
  Checkpoint,
  Exit
} from '@cryptoeconomicslab/plasma'
import { DoubleLayerInclusionProof } from '@cryptoeconomicslab/merkle-tree'
import { Wallet } from '@cryptoeconomicslab/wallet'
import { hint } from '@cryptoeconomicslab/ovm'
import {
  StateUpdateRepository,
  SyncRepository,
  InclusionProofRepository,
  TransactionRepository,
  CheckpointRepository,
  ExitRepository
} from '../../src/repository'

// prepare StateUpdate, Transaction, Signature, InclusionProof and  BlockRoot
export async function prepareSU(witnessDb: KeyValueStore, su: StateUpdate) {
  const suRepo = await StateUpdateRepository.init(witnessDb)
  await suRepo.insertWitnessStateUpdate(su)
  await suRepo.insertVerifiedStateUpdate(su)
}

export async function prepareTx(
  witnessDb: KeyValueStore,
  su: StateUpdate,
  from: Wallet,
  stateObject: Property
): Promise<SignedTransaction> {
  const txRepo = await TransactionRepository.init(witnessDb)
  const { blockNumber, depositContractAddress, range } = su
  const tx = new SignedTransaction(
    depositContractAddress,
    range,
    BigNumber.from(100),
    stateObject,
    FixedBytes.default(32),
    from.getAddress(),
    Bytes.default()
  )
  await txRepo.insertTransaction(depositContractAddress, blockNumber, range, tx)
  return tx
}

export async function prepareSignature(
  witnessDb: KeyValueStore,
  transaction: UnsignedTransaction,
  from: Wallet
): Promise<Bytes> {
  const signedTx = await transaction.sign(from)
  await putWitness(
    witnessDb,
    hint.createSignatureHint(transaction.message),
    signedTx.signature
  )
  return signedTx.signature
}

export async function prepareInclusionProof(
  witnessDb: KeyValueStore,
  su: StateUpdate,
  block: Block
): Promise<DoubleLayerInclusionProof> {
  const { blockNumber, range, depositContractAddress } = su
  const inclusionProofRepo = await InclusionProofRepository.init(witnessDb)

  const inclusionProof = block.getInclusionProof(
    su
  ) as DoubleLayerInclusionProof

  await inclusionProofRepo.insertInclusionProof(
    depositContractAddress,
    blockNumber,
    range,
    inclusionProof
  )

  await inclusionProofRepo.insertInclusionProof(
    depositContractAddress,
    blockNumber,
    range,
    inclusionProof
  )
  return inclusionProof
}

export async function prepareBlock(
  witnessDb: KeyValueStore,
  su: StateUpdate,
  otherStateUpdates: StateUpdate[] = []
): Promise<Block> {
  const syncRepo = await SyncRepository.init(witnessDb)
  const { blockNumber, depositContractAddress } = su

  const suList = [su, ...otherStateUpdates]
  const suMap = new Map<string, StateUpdate[]>()
  suMap.set(depositContractAddress.data, suList)

  const block = new Block(blockNumber, suMap)
  const root = block.getRoot()
  await syncRepo.insertBlockRoot(blockNumber, root)

  return block
}

export async function prepareCheckpoint(
  witnessDb: KeyValueStore,
  stateUpdate: StateUpdate,
  claimedAt: BigNumber
) {
  const repo = await CheckpointRepository.init(witnessDb)
  const checkpoint = new Checkpoint(stateUpdate, claimedAt)
  await repo.insertClaimedCheckpoint(checkpoint)
}

export async function prepareExit(
  witnessDb: KeyValueStore,
  stateUpdate: StateUpdate,
  claimedAt: BigNumber
) {
  const repo = await ExitRepository.init(witnessDb)
  const exit = new Exit(stateUpdate, claimedAt)
  await repo.insertClaimedExit(exit)
}

/* given stateUpdate and witnessDb,
 * create block including the stateUpdate and inclusionProof of it,
 * store stateUpdate, block and inclusionProof
 */
export async function prepareValidSU(
  witnessDb: KeyValueStore,
  su: StateUpdate,
  otherStateUpdates: StateUpdate[] = []
): Promise<{
  block: Block
  stateUpdate: StateUpdate
  inclusionProof: DoubleLayerInclusionProof
}> {
  await prepareSU(witnessDb, su)
  const block = await prepareBlock(witnessDb, su, otherStateUpdates)
  const inclusionProof = await prepareInclusionProof(witnessDb, su, block)

  return {
    block,
    stateUpdate: su,
    inclusionProof
  }
}

export async function prepareValidTxAndSig(
  witnessDb: KeyValueStore,
  su: StateUpdate,
  wallet: Wallet,
  nextSO: Property
): Promise<{
  tx: SignedTransaction
  sig: Bytes
}> {
  const tx = await prepareTx(witnessDb, su, wallet, nextSO)
  const sig = await prepareSignature(witnessDb, tx.toUnsigned(), wallet)
  return { tx, sig }
}
