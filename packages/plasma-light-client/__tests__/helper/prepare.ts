import { Bytes, BigNumber, Property } from '@cryptoeconomicslab/primitives'
import { KeyValueStore, putWitness } from '@cryptoeconomicslab/db'
import { StateUpdate, Transaction, Block } from '@cryptoeconomicslab/plasma'
import { DoubleLayerInclusionProof } from '@cryptoeconomicslab/merkle-tree'
import { Wallet } from '@cryptoeconomicslab/wallet'
import { hint } from '@cryptoeconomicslab/ovm'
import {
  StateUpdateRepository,
  SyncRepository,
  InclusionProofRepository,
  TransactionRepository
} from '../../src/repository'

// prepare StateUpdate, Transaction, Signature, InclusionProof and  BlockRoot
export async function prepareSU(witnessDb: KeyValueStore, su: StateUpdate) {
  const suRepo = await StateUpdateRepository.init(witnessDb)
  await suRepo.insertWitnessStateUpdate(su)
  await suRepo.insertVerifiedStateUpdate(su.depositContractAddress, su)
}

export async function prepareTx(
  witnessDb: KeyValueStore,
  su: StateUpdate,
  from: Wallet,
  stateObject: Property
): Promise<Transaction> {
  const txRepo = await TransactionRepository.init(witnessDb)
  const { blockNumber, depositContractAddress, range } = su
  const tx = new Transaction(
    depositContractAddress,
    range,
    BigNumber.from(100),
    stateObject,
    from.getAddress()
  )
  await txRepo.insertTransaction(depositContractAddress, blockNumber, range, tx)
  return tx
}

export async function prepareSignature(
  witnessDb: KeyValueStore,
  transaction: Transaction,
  from: Wallet
): Promise<Bytes> {
  const txBytes = ovmContext.coder.encode(transaction.body)
  const sign = await from.signMessage(txBytes)
  await putWitness(witnessDb, hint.createSignatureHint(txBytes), sign)
  return sign
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
  tx: Transaction
  sig: Bytes
}> {
  const tx = await prepareTx(witnessDb, su, wallet, nextSO)
  const sig = await prepareSignature(witnessDb, tx, wallet)
  return { tx, sig }
}
