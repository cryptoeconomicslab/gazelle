import { Property, Bytes } from '@cryptoeconomicslab/primitives'
import { StateUpdate } from '@cryptoeconomicslab/plasma'
import { DeciderManager } from '@cryptoeconomicslab/ovm'
import { KeyValueStore, RangeDb } from '@cryptoeconomicslab/db'

interface ExitDisputeContract {
  claim(inputs: Bytes[], witnesses: Bytes[]): Promise<void>
  challenge(
    inputs: Bytes[],
    challengeInputs: Bytes[],
    witnesses: Bytes[]
  ): Promise<void>
  subscribeExitClaim(handler: (stateUpdate: StateUpdate) => Promise<void>): void
  subscribeExitChallenged(
    handler: (stateUpdate: StateUpdate) => Promise<void>
  ): void
  subscribeExitSettled(
    handler: (stateUpdate: StateUpdate) => Promise<void>
  ): void
}

export class ExitDispte {
  private contractWrapper: ExitDisputeContract
  private witnessDb: KeyValueStore
  private deciderManager: DeciderManager

  constructor(
    contractWrapper: ExitDisputeContract,
    deciderManager: DeciderManager,
    witnessDb: KeyValueStore
  ) {
    this.contractWrapper = contractWrapper
    this.deciderManager = deciderManager
    this.witnessDb = witnessDb
    // watch exit contract to handle challenge
    this.contractWrapper.subscribeExitClaim(this.handleExitClaimed)
    this.contractWrapper.subscribeExitChallenged(this.handleExitChallenged)
    this.contractWrapper.subscribeExitSettled(this.handleExitSettled)
  }

  private async getTransaction(
    stateUpdate: StateUpdate
  ): Promise<Bytes | null> {
    const txBucket = await this.witnessDb.bucket(Bytes.fromString('tx'))
    const blockBucket = await txBucket.bucket(
      Bytes.fromHexString(stateUpdate.blockNumber.toHexString())
    )
    const rangeDb = new RangeDb(blockBucket)
    const txs = await rangeDb.get(
      stateUpdate.range.start.data,
      stateUpdate.range.end.data
    )
    if (txs.length === 0) {
      return null
    }
    return txs[0].value
  }

  private async getInclusionProof(stateUpdate: StateUpdate): Promise<Bytes> {
    const inclusionProofBucket = await this.witnessDb.bucket(
      Bytes.fromString('inclusion_proof')
    )
    const blockBucket = await inclusionProofBucket.bucket(
      Bytes.fromHexString(stateUpdate.blockNumber.toHexString())
    )
    const rangeDb = new RangeDb(blockBucket)
    const inclusionProofs = await rangeDb.get(
      stateUpdate.range.start.data,
      stateUpdate.range.end.data
    )
    if (inclusionProofs.length !== 1) {
      throw new Error('invalid stateUpdate range')
    }
    return inclusionProofs[0].value
  }

  /**
   * @name claimExit
   * @description claims "exiting a StateUpdate" to ExitDispute contract
   * @param stateUpdate A StateUpdate to exit
   */
  async claimExit(stateUpdate: StateUpdate) {
    const inclusionProof = await this.getInclusionProof(stateUpdate)
    this.contractWrapper.claim(
      [ovmContext.coder.encode(stateUpdate.property.toStruct())],
      [inclusionProof]
    )
  }

  /**
   * @name handleExitClaimed
   * @description handle ExitClaimed event from ExitDispute contract
   * @param stateUpdate
   */
  async handleExitClaimed(stateUpdate: StateUpdate) {
    // challenge
    // check that a transaction is exists
    const tx = await this.getTransaction(stateUpdate)
    if (!tx) {
      console.warn('tx not fonud')
      return
    }
    const stateObject = new Property(
      stateUpdate.stateObject.deciderAddress,
      stateUpdate.stateObject.inputs.concat([tx])
    )
    const decision = await this.deciderManager.decide(stateObject, {})
    // TODO: call Checkpoint.handleCheckpointClaimed(stateUpdate)
    if (decision.outcome) {
      await this.contractWrapper.challenge(
        [ovmContext.coder.encode(stateUpdate.property.toStruct())],
        [],
        [tx]
      )
    }
  }

  async handleExitChallenged(stateUpdate: StateUpdate) {}
  async handleExitSettled(stateUpdate: StateUpdate) {}
}
