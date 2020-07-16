import {
  Address,
  Property,
  Bytes,
  BigNumber
} from '@cryptoeconomicslab/primitives'
import { ICheckpointDisputeContract } from '@cryptoeconomicslab/contract'
import { KeyValueStore, getWitnesses, putWitness } from '@cryptoeconomicslab/db'
import {
  StateUpdate,
  Transaction,
  Checkpoint
} from '@cryptoeconomicslab/plasma'
import { DoubleLayerInclusionProof } from '@cryptoeconomicslab/merkle-tree'
import { decodeStructable } from '@cryptoeconomicslab/coder'
import { hint as Hint, DeciderManager } from '@cryptoeconomicslab/ovm'
import {
  StateUpdateRepository,
  SyncRepository,
  CheckpointRepository
} from '../repository'
import APIClient from '../APIClient'
import JSBI from 'jsbi'
import { verifyTransaction } from '../verifier/TransactionVerifier'
import { mergeWitness } from '../helper/stateObjectHelper'

type CheckpointDecision = {
  decision: boolean
  challenge?: StateUpdate
}

type CheckpointWitness = {
  stateUpdate: string
  transaction: { tx: string; witness: string }
  inclusionProof: string | null
}

const INTERVAL = 60000
const DISPUTE_PERIOD = 100

/**
 * CheckpointDispute class used by Plasma Light Client responsible for following activities
 * - claim checkpoint when necessary
 * - watch checkpoint dispute contract
 * - challenge checkpoint claim when necessary
 * - removeChallenge checkpoint challenge when necessary
 * - settle checkpoint when possible
 * - polling to settle claimed checkpoint if this client claimed a checkpoint
 */
export class CheckpointDispute {
  private polling = false
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(
    private contract: ICheckpointDisputeContract,
    private witnessDb: KeyValueStore,
    private deciderManager: DeciderManager,
    private apiClient: APIClient
  ) {
    contract.subscribeCheckpointClaimed(this.handleCheckpointClaimed)
    contract.subscribeCheckpointChallenged(this.handleCheckpointChallenged)
    contract.subscribeCheckpointChallengeRemoved(this.handleChallengeRemoved)
    contract.subscribeCheckpointSettled(this.handleCheckpointSettled)
  }

  /**
   * check if checkpoint can be created at given stateUpdate
   * if not, returns false and challenge inputs and witness
   * @param stateUpdate to create checkpoint
   */
  public async verifyCheckpoint(
    stateUpdate: StateUpdate
  ): Promise<CheckpointDecision> {
    const { coder } = ovmContext
    const { depositContractAddress, range } = stateUpdate
    const suHint = (b: JSBI) =>
      Hint.createStateUpdateHint(
        BigNumber.from(b),
        depositContractAddress,
        range
      )
    const txHint = (su: StateUpdate) =>
      Hint.createTxHint(su.blockNumber, su.depositContractAddress, su.range)

    for (
      let b = JSBI.BigInt(0);
      JSBI.lessThan(b, stateUpdate.blockNumber.data);
      b = JSBI.add(b, JSBI.BigInt(1))
    ) {
      // get stateUpdates and transaction
      const stateUpdateWitnesses = await getWitnesses(this.witnessDb, suHint(b))
      await Promise.all(
        stateUpdateWitnesses.map(async stateUpdateWitness => {
          const su = StateUpdate.fromProperty(
            decodeStructable(Property, coder, stateUpdateWitness)
          )

          const txWitnesses = await getWitnesses(this.witnessDb, txHint(su))
          if (txWitnesses.length !== 1) {
            return { decision: false, challenge: su }
          }
          const tx = Transaction.fromProperty(
            decodeStructable(Property, coder, txWitnesses[0])
          )

          // validate transaction
          const verified = verifyTransaction(su, tx)
          if (!verified) {
            return { decision: false, challenge: su }
          }

          // validate stateObject
          const stateObject = mergeWitness(su.stateObject, txWitnesses)
          const decision = await this.deciderManager.decide(stateObject)
          if (!decision.outcome) {
            return { decision: false, challenge: su }
          }
        })
      )
    }

    return { decision: true }
  }

  private async handleCheckpointClaimed(
    stateUpdate: StateUpdate,
    _inclusionProof: DoubleLayerInclusionProof
  ) {
    const { coder } = ovmContext
    const repository = await StateUpdateRepository.init(this.witnessDb)

    // check if claimed stateUpdate is same range and greater blockNumber of owning stateUpdate
    const stateUpdates = await repository.getVerifiedStateUpdates(
      stateUpdate.depositContractAddress,
      stateUpdate.range
    )
    if (stateUpdates.length === 0) return

    const challengeSu = stateUpdates.find(su =>
      JSBI.lessThan(su.blockNumber.data, stateUpdate.blockNumber.data)
    )
    if (!challengeSu) return

    await this.prepareCheckpointWitness(stateUpdate)

    // evaluate the stateUpdate history validity and
    const result = await this.verifyCheckpoint(stateUpdate)
    if (!result.challenge && result.decision) return

    // get inclusionProof of challengingStateUpdate
    const challengingStateUpdate = result.challenge as StateUpdate
    const inclusionProofBytes = await getWitnesses(
      this.witnessDb,
      Hint.createInclusionProofHint(
        challengingStateUpdate.blockNumber,
        challengingStateUpdate.depositContractAddress,
        challengingStateUpdate.range
      )
    )
    const inclusionProof = decodeStructable(
      DoubleLayerInclusionProof,
      coder,
      inclusionProofBytes[0]
    )

    await this.challenge(stateUpdate, challengingStateUpdate, inclusionProof)
    console.log('Challenge checkpoint')
  }

  private async handleCheckpointChallenged(
    stateUpdate: StateUpdate,
    challenge: StateUpdate,
    inclusionProof: DoubleLayerInclusionProof
  ) {
    console.log(
      'checkpoint challenged. check the validity and remove with witness'
    )
    // TODO: OPTIMIZE check if challenged stateUpdate is which this client claimed. stored in checkpoint repository?
    const txWitness = await getWitnesses(
      this.witnessDb,
      Hint.createTxHint(
        challenge.blockNumber,
        challenge.depositContractAddress,
        challenge.range
      )
    )
    if (txWitness.length !== 1) {
      // do nothing
      return
    }

    const signature = await getWitnesses(
      this.witnessDb,
      Hint.createSignatureHint(txWitness[0])
    )
    if (signature.length !== 1) {
      // do nothing
      return
    }

    await this.removeChallenge(stateUpdate, challenge, [
      txWitness[0],
      signature[0]
    ])
  }

  private handleChallengeRemoved(
    stateUpdate: StateUpdate,
    challenge: StateUpdate
  ) {
    // you can do nothing. challenge is just removed
    console.log('checkpoint challenge removed')
  }

  private async handleCheckpointSettled(stateUpdate: StateUpdate) {
    console.log('checkpoint settled') // TODO: log informative message
    const repository = await CheckpointRepository.init(this.witnessDb)
    const claimedCheckpoints = await repository.getClaimedCheckpoints(
      stateUpdate.depositContractAddress,
      stateUpdate.range
    )
    if (claimedCheckpoints.length === 1) {
      const checkpoint = claimedCheckpoints[0]
      await repository.removeClaimedCheckpoint(checkpoint)
      await repository.insertSettledCheckpoint(checkpoint.stateUpdate)
    }
  }

  /**
   * polling claim if there remains claims not settled, do polling
   * stop polling when no claims remains.
   */
  private pollClaim() {
    this.timer = setTimeout(async () => {
      const checkpoints = await this.getAllClaimedCheckpoints()
      const syncRepo = await SyncRepository.init(this.witnessDb)
      const currentBlockNumber = await syncRepo.getSyncedBlockNumber()

      if (checkpoints.length > 0) {
        checkpoints.map(c => {
          if (
            JSBI.lessThanOrEqual(
              JSBI.add(c.claimedBlockNumber.data, JSBI.BigInt(DISPUTE_PERIOD)),
              currentBlockNumber.data
            )
          ) {
            this.settle(c.stateUpdate)
          }
        })
        this.pollClaim()
      }
    }, INTERVAL)
  }

  /**
   * claim checkpoint.
   * LightClient does not call checkpoint from this method in ordinaly case
   */
  public async claim(
    stateUpdate: StateUpdate,
    inclusionProof: DoubleLayerInclusionProof
  ) {
    const syncRepo = await SyncRepository.init(this.witnessDb)
    const claimedBlockNumber = await syncRepo.getSyncedBlockNumber()
    await this.contract.claim(stateUpdate, inclusionProof)

    const checkpoint = new Checkpoint(stateUpdate, claimedBlockNumber)
    const checkpointRepo = await CheckpointRepository.init(this.witnessDb)
    await checkpointRepo.insertClaimedCheckpoint(checkpoint)
    if (!this.polling) this.pollClaim()
  }

  /**
   * challenge to checkpoint
   */
  public async challenge(
    stateUpdate: StateUpdate,
    challenge: StateUpdate,
    inclusionProof: DoubleLayerInclusionProof
  ) {
    await this.contract.challenge(stateUpdate, challenge, inclusionProof)
  }

  /**
   * remove challenge by submitting witness
   * witness: [tx, signature]
   */
  public async removeChallenge(
    stateUpdate: StateUpdate,
    challenge: StateUpdate,
    witness: Bytes[]
  ) {
    await this.contract.removeChallenge(stateUpdate, challenge, witness)
  }

  /**
   * settle checkpoint claim
   */
  public async settle(stateUpdate: StateUpdate) {
    await this.contract.settle(stateUpdate)
  }

  private async getAllClaimedCheckpoints(): Promise<Checkpoint[]> {
    return []
  }

  private async prepareCheckpointWitness(stateUpdate: StateUpdate) {
    const { coder } = ovmContext
    const res = await this.apiClient.checkpointWitness(
      stateUpdate.depositContractAddress,
      stateUpdate.blockNumber,
      stateUpdate.range
    )

    // FIXME: use repository instead of `putWitness`
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
              coder.decode(Transaction.getParamTypes(), txBytes)
            )
              .toProperty(Address.default()) // TODO: should put tx address
              .toStruct()
          )
          await putWitness(
            witnessDb,
            Hint.createTxHint(blockNumber, depositContractAddress, range),
            txPropertyBytes
          )
          await putWitness(
            witnessDb,
            Hint.createSignatureHint(txBytes),
            Bytes.fromHexString(witness.transaction.witness)
          )
        }
      })
    )
  }
}
