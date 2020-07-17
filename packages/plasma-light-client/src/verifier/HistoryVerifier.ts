import {
  Address,
  Bytes,
  BigNumber,
  Property
} from '@cryptoeconomicslab/primitives'
import { StateUpdate, Transaction } from '@cryptoeconomicslab/plasma'
import { DoubleLayerInclusionProof } from '@cryptoeconomicslab/merkle-tree'
import { decodeStructable } from '@cryptoeconomicslab/coder'
import { hint as Hint, DeciderManager } from '@cryptoeconomicslab/ovm'
import { putWitness, KeyValueStore } from '@cryptoeconomicslab/db'
import APIClient from '../APIClient'

export class HistoryVerifier {
  constructor(
    private witnessDb: KeyValueStore,
    private apiClient: APIClient,
    private deciderManager: DeciderManager
  ) {}

  /**
   * FIXME: will removed CheckpointDispute will be used instead
   * create checkpoint property to validate stateUpdate
   * @param stateUpdate stateUpdate of which history should be validated
   * @param inclusionProof inclusionProof of stateUpdate
   */
  private checkpointProperty(
    stateUpdate: StateUpdate,
    inclusionProof: DoubleLayerInclusionProof
  ): Property {
    const checkpointPredicate = this.deciderManager.compiledPredicateMap.get(
      'Checkpoint'
    )
    if (!checkpointPredicate)
      throw new Error('Checkpoint predicate is not initialized')
    const { coder } = ovmContext
    return checkpointPredicate.makeProperty([
      coder.encode(stateUpdate.property.toStruct()),
      coder.encode(inclusionProof.toStruct())
    ])
  }

  /**
   * verify the history of given state update by deciding checkpoint property
   * @param stateUpdate stateUpdate to verify history
   * @param blockNumber blockNumber of the stateUpdate
   */
  public async verifyStateUpdateHistory(
    stateUpdate: StateUpdate,
    blockNumber: BigNumber
  ): Promise<boolean> {
    const { coder } = ovmContext

    // get inclusionProof of latest su
    let inclusionProof: DoubleLayerInclusionProof

    try {
      const res = await this.apiClient.inclusionProof(stateUpdate)
      inclusionProof = decodeStructable(
        DoubleLayerInclusionProof,
        coder,
        Bytes.fromHexString(res.data.data)
      )
    } catch (e) {
      // return false error happens while getting inclusionProof
      // TODO: if error other than 404 happens, set retry to get inclusion proof
      return false
    }

    const address = stateUpdate.depositContractAddress

    const hint = Hint.createInclusionProofHint(
      blockNumber,
      address,
      stateUpdate.range
    )
    await putWitness(
      this.witnessDb,
      hint,
      coder.encode(inclusionProof.toStruct())
    )
    try {
      // TODO: get witness that don't exists in local database
      const res = await this.apiClient.checkpointWitness(
        address,
        blockNumber,
        stateUpdate.range
      )

      type CheckpointWitness = {
        stateUpdate: string
        transaction: { tx: string; witness: string }
        inclusionProof: string | null
      }

      const witnessDb = this.witnessDb
      await Promise.all(
        res.data.data.map(async (witness: CheckpointWitness) => {
          const stateUpdate = StateUpdate.fromProperty(
            decodeStructable(
              Property,
              coder,
              Bytes.fromHexString(witness.stateUpdate)
            )
          )
          const { blockNumber, depositContractAddress, range } = stateUpdate
          await putWitness(
            witnessDb,
            Hint.createStateUpdateHint(
              blockNumber,
              depositContractAddress,
              range
            ),
            Bytes.fromHexString(witness.stateUpdate)
          )
          if (witness.inclusionProof) {
            await putWitness(
              witnessDb,
              Hint.createInclusionProofHint(
                blockNumber,
                depositContractAddress,
                range
              ),
              Bytes.fromHexString(witness.inclusionProof)
            )
          }
          if (witness.transaction) {
            const txBytes = Bytes.fromHexString(witness.transaction.tx)
            const txPropertyBytes = coder.encode(
              Transaction.fromStruct(
                coder.decode(Transaction.getParamType(), txBytes)
              )
                .toProperty(Address.default())
                .toStruct()
            )
            await putWitness(
              witnessDb,
              Hint.createTxHint(blockNumber, depositContractAddress, range),
              txPropertyBytes
            )
            await putWitness(
              witnessDb,
              Hint.createSignatureHint(txPropertyBytes),
              Bytes.fromHexString(witness.transaction.witness)
            )
          }
        })
      )
    } catch (e) {
      return false
    }

    // verify received state update
    const checkpointProperty = this.checkpointProperty(
      stateUpdate,
      inclusionProof
    )
    // FIXME: use checkpoint dispute
    const decision = await this.deciderManager.decide(checkpointProperty)

    return decision.outcome
  }
}
