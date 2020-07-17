import {
  Property,
  Bytes,
  BigNumber,
  Range
} from '@cryptoeconomicslab/primitives'
import { ICheckpointDisputeContract } from '@cryptoeconomicslab/contract'
import { KeyValueStore, getWitnesses, putWitness } from '@cryptoeconomicslab/db'
import {
  StateUpdate,
  Transaction,
  Checkpoint,
  Block
} from '@cryptoeconomicslab/plasma'
import {
  DoubleLayerInclusionProof,
  DoubleLayerTreeVerifier
} from '@cryptoeconomicslab/merkle-tree'
import { decodeStructable } from '@cryptoeconomicslab/coder'
import { hint as Hint, DeciderManager } from '@cryptoeconomicslab/ovm'
import {
  StateUpdateRepository,
  SyncRepository,
  CheckpointRepository,
  TransactionRepository,
  InclusionProofRepository
} from '../repository'
import APIClient from '../APIClient'
import JSBI from 'jsbi'
import { verifyTransaction } from '../verifier/TransactionVerifier'
import { mergeWitness } from '../helper/stateObjectHelper'
import TokenManager from '../managers/TokenManager'

type CheckpointDecision = {
  decision: boolean
  challenge?: StateUpdate
}

type CheckpointWitness = {
  stateUpdate: string
  transaction: { tx: string; witness: string }
  inclusionProof: string
}

const INTERVAL = 60000
const DISPUTE_PERIOD = 100 // FIXME: set correct dispute period from .env

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
    private tokenManager: TokenManager,
    private apiClient: APIClient
  ) {
    contract.subscribeCheckpointClaimed(this.handleCheckpointClaimed)
    contract.subscribeCheckpointChallenged(this.handleCheckpointChallenged)
    contract.subscribeCheckpointChallengeRemoved(this.handleChallengeRemoved)
    contract.subscribeCheckpointSettled(this.handleCheckpointSettled)
  }

  /**
   * check if checkpoint can be created at given stateUpdate
   * if not, returns false and returns challenge inputs and witness
   * @param stateUpdate to create checkpoint
   */
  public async verifyCheckpoint(
    stateUpdate: StateUpdate
  ): Promise<CheckpointDecision> {
    const { coder } = ovmContext
    const { depositContractAddress, range } = stateUpdate
    const suRepo = await StateUpdateRepository.init(this.witnessDb)
    const txRepo = await TransactionRepository.init(this.witnessDb)
    const inclusionProofRepo = await InclusionProofRepository.init(
      this.witnessDb
    )
    const syncRepo = await SyncRepository.init(this.witnessDb)
    const inclusionProofVerifier = new DoubleLayerTreeVerifier()

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

          // check inclusion proof
          const inclusionProof = await inclusionProofRepo.getInclusionProofs(
            depositContractAddress,
            su.blockNumber,
            range
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

          const txWitnesses = await txRepo.getTransactions(
            depositContractAddress,
            blockNumber,
            range
          )
          if (txWitnesses.length !== 1) {
            return { decision: false, challenge: su }
          }
          // validate transaction
          const tx = txWitnesses[0]
          const verified = verifyTransaction(su, tx)
          if (!verified) {
            return { decision: false, challenge: su }
          }

          // validate stateObject
          const stateObject = mergeWitness(su.stateObject, [
            coder.encode(tx.body)
          ])
          try {
            const decision = await this.deciderManager.decide(stateObject)
            if (!decision.outcome) {
              return { decision: false, challenge: su }
            }
          } catch (e) {
            return { decision: false, challenge: su }
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

  private async handleCheckpointClaimed(
    stateUpdate: StateUpdate,
    _inclusionProof: DoubleLayerInclusionProof
  ) {
    const suRepo = await StateUpdateRepository.init(this.witnessDb)
    const inclusionProofRepo = await InclusionProofRepository.init(
      this.witnessDb
    )

    // check if claimed stateUpdate is same range and greater blockNumber of owning stateUpdate
    const stateUpdates = await suRepo.getVerifiedStateUpdates(
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
    const inclusionProofs = await inclusionProofRepo.getInclusionProofs(
      challengingStateUpdate.depositContractAddress,
      challengingStateUpdate.blockNumber,
      challengingStateUpdate.range
    )

    await this.challenge(
      stateUpdate,
      challengingStateUpdate,
      inclusionProofs[0]
    )
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
    const { coder } = ovmContext

    const checkpointRepo = await CheckpointRepository.init(this.witnessDb)
    const claims = await checkpointRepo.getClaimedCheckpoints(
      stateUpdate.depositContractAddress,
      stateUpdate.range
    )
    if (claims.length === 0) return

    const txRepo = await TransactionRepository.init(this.witnessDb)
    const transactions = await txRepo.getTransactions(
      challenge.depositContractAddress,
      challenge.blockNumber,
      challenge.range
    )
    if (transactions.length !== 1) {
      // do nothing
      return
    }
    const txBytes = coder.encode(transactions[0].body)

    const signature = await getWitnesses(
      this.witnessDb,
      Hint.createSignatureHint(txBytes)
    )
    if (signature.length !== 1) {
      // do nothing
      return
    }

    await this.removeChallenge(stateUpdate, challenge, [txBytes, signature[0]])
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
    const checkpointRepository = await CheckpointRepository.init(this.witnessDb)
    const checkpoints = await Promise.all(
      this.tokenManager.depositContractAddresses.map(async addr => {
        return await checkpointRepository.getClaimedCheckpoints(
          addr,
          new Range(BigNumber.from(0), BigNumber.MAX_NUMBER)
        )
      })
    )

    // flatten checkpoints
    return ([] as Checkpoint[]).concat(...checkpoints)
  }

  private async prepareCheckpointWitness(stateUpdate: StateUpdate) {
    const { coder } = ovmContext
    const res = await this.apiClient.checkpointWitness(
      stateUpdate.depositContractAddress,
      stateUpdate.blockNumber,
      stateUpdate.range
    )

    const witnessDb = this.witnessDb
    const suRepository = await StateUpdateRepository.init(witnessDb)
    const txRepository = await TransactionRepository.init(witnessDb)
    const inclusionProofRepository = await InclusionProofRepository.init(
      witnessDb
    )

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
        await suRepository.insertWitnessStateUpdate(stateUpdate)

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

        const txBytes = Bytes.fromHexString(witness.transaction.tx)
        const tx = Transaction.fromStruct(
          coder.decode(Transaction.getParamType(), txBytes)
        )
        await txRepository.insertTransaction(
          depositContractAddress,
          blockNumber,
          range,
          tx
        )

        await putWitness(
          witnessDb,
          Hint.createSignatureHint(coder.encode(tx.body)),
          Bytes.fromHexString(witness.transaction.witness)
        )
      })
    )
  }
}
