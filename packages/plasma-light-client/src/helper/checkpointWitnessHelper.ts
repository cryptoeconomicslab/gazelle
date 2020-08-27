import { Bytes } from '@cryptoeconomicslab/primitives'
import { putWitness, KeyValueStore } from '@cryptoeconomicslab/db'
import { StateUpdate, SignedTransaction } from '@cryptoeconomicslab/plasma'
import { DoubleLayerInclusionProof } from '@cryptoeconomicslab/merkle-tree'
import { decodeStructable } from '@cryptoeconomicslab/coder'
import { hint as Hint } from '@cryptoeconomicslab/ovm'
import {
  StateUpdateRepository,
  TransactionRepository,
  InclusionProofRepository
} from '../repository'
import APIClient from '../APIClient'

type CheckpointWitness = {
  stateUpdate: string
  txs: string[]
  inclusionProof: string | null
}

export async function prepareCheckpointWitness(
  stateUpdate: StateUpdate,
  apiClient: APIClient,
  witnessDb: KeyValueStore
) {
  const { coder } = ovmContext

  let res
  try {
    res = await apiClient.checkpointWitness(
      stateUpdate.depositContractAddress,
      stateUpdate.blockNumber,
      stateUpdate.range
    )
  } catch (e) {
    console.log(e)
    return
  }

  const suRepository = await StateUpdateRepository.init(witnessDb)
  const txRepository = await TransactionRepository.init(witnessDb)
  const inclusionProofRepository = await InclusionProofRepository.init(
    witnessDb
  )

  await Promise.all(
    res.data.data.map(async (witness: CheckpointWitness) => {
      const stateUpdate = decodeStructable(
        StateUpdate,
        coder,
        Bytes.fromHexString(witness.stateUpdate)
      )
      const { blockNumber, depositContractAddress, range } = stateUpdate
      await suRepository.insertWitnessStateUpdate(stateUpdate)

      if (witness.inclusionProof) {
        const inclusionProof = decodeStructable(
          DoubleLayerInclusionProof,
          coder,
          Bytes.fromHexString(witness.inclusionProof)
        )
        await inclusionProofRepository.insertInclusionProof(
          depositContractAddress,
          blockNumber,
          range,
          inclusionProof
        )
      }

      for (const txHexString of witness.txs) {
        const txBytes = Bytes.fromHexString(txHexString)
        const tx = decodeStructable(SignedTransaction, coder, txBytes)
        await txRepository.insertTransaction(
          depositContractAddress,
          blockNumber,
          tx.range,
          tx
        )

        await putWitness(
          witnessDb,
          Hint.createSignatureHint(tx.message),
          tx.signature
        )
      }
    })
  )
}
