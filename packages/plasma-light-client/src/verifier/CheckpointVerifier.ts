import { BigNumber, Range } from '@cryptoeconomicslab/primitives'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import {
  StateUpdate,
  Block,
  verifyTransaction
} from '@cryptoeconomicslab/plasma'
import { DoubleLayerTreeVerifier } from '@cryptoeconomicslab/merkle-tree'
import { DeciderManager } from '@cryptoeconomicslab/ovm'
import {
  StateUpdateRepository,
  SyncRepository,
  TransactionRepository,
  InclusionProofRepository,
  CheckpointRepository
} from '../repository'
import JSBI from 'jsbi'

type CheckpointDecision = {
  decision: boolean
  challenge?: StateUpdate
}

/**
 * check if checkpoint can be created at given stateUpdate
 * if not, returns false and returns challenge inputs and witness
 * @param stateUpdate to create checkpoint
 */
export async function verifyCheckpoint(
  witnessDb: KeyValueStore,
  deciderManager: DeciderManager,
  stateUpdate: StateUpdate
): Promise<CheckpointDecision> {
  const { depositContractAddress, range } = stateUpdate
  const suRepo = await StateUpdateRepository.init(witnessDb)
  const txRepo = await TransactionRepository.init(witnessDb)
  const inclusionProofRepo = await InclusionProofRepository.init(witnessDb)
  const syncRepo = await SyncRepository.init(witnessDb)
  const inclusionProofVerifier = new DoubleLayerTreeVerifier()
  const checkpointRepo = await CheckpointRepository.init(witnessDb)

  for (
    let b = JSBI.BigInt(0);
    JSBI.lessThan(b, stateUpdate.blockNumber.data);
    b = JSBI.add(b, JSBI.BigInt(1))
  ) {
    const blockNumber = BigNumber.from(b)
    // get stateUpdates and transaction
    const stateUpdateWitnesses = await suRepo.getWitnessStateUpdates(
      depositContractAddress,
      blockNumber,
      range
    )

    const result = await Promise.all(
      stateUpdateWitnesses.map(async su => {
        const blockRoot = await syncRepo.getBlockRoot(blockNumber)
        if (!blockRoot)
          throw new Error(`Merkle root at ${blockNumber.raw} is missing.`)

        const checkpoint = await checkpointRepo.getSettledCheckpoints(
          su.depositContractAddress,
          su.range
        )

        if (
          checkpoint.length !== 0 &&
          checkpoint[0].blockNumber.equals(su.blockNumber)
        ) {
          return { decision: true }
        }

        // check inclusion proof
        const inclusionProof = await inclusionProofRepo.getInclusionProofs(
          depositContractAddress,
          su.blockNumber,
          su.range
        )
        if (inclusionProof.length !== 1) {
          return { decision: false, challenge: su }
        }

        if (
          !inclusionProofVerifier.verifyInclusion(
            Block.generateLeaf(su),
            su.range,
            blockRoot,
            inclusionProof[0]
          )
        ) {
          // Cannot challenge with stateUpdate not included in tree.
          // TODO: is this okay?
          return { decision: true }
        }

        if (
          ovmContext.coder
            .encode(stateUpdate.stateObject.toStruct())
            .equals(ovmContext.coder.encode(su.stateObject.toStruct()))
        ) {
          return { decision: true }
        }

        /**
         * validate deprecation of `su`'s all range.
         */
        const txWitnesses = await txRepo.getTransactions(
          depositContractAddress,
          blockNumber,
          su.range
        )
        if (txWitnesses.length === 0) {
          return { decision: false, challenge: su }
        }

        // transactions satisfies su.range
        const concatenatedRange = Range.concat(txWitnesses.map(tx => tx.range))
        const requiredRange = Range.getIntersection(su.range, range)
        if (
          concatenatedRange === null ||
          requiredRange === null ||
          !concatenatedRange.contains(requiredRange)
        ) {
          return { decision: false, challenge: su }
        }
        for (const tx of txWitnesses) {
          // validate transaction
          const verified = verifyTransaction(su, tx)
          if (!verified) {
            return { decision: false, challenge: su }
          }

          // validate stateObject
          const stateObject = su.stateObject.appendInput([tx.message])
          try {
            const decision = await deciderManager.decide(stateObject)
            if (!decision.outcome) {
              return { decision: false, challenge: su }
            }
          } catch (e) {
            return { decision: false, challenge: su }
          }
        }

        return { decision: true }
      })
    )

    const challenge = result.find(r => !r.decision)
    if (challenge) {
      return challenge
    }
  }

  return { decision: true }
}
