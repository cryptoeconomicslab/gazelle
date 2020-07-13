import EventEmitter from 'event-emitter'
import {
  Address,
  Bytes,
  BigNumber,
  FixedBytes,
  Range
} from '@cryptoeconomicslab/primitives'
import { putWitness, KeyValueStore } from '@cryptoeconomicslab/db'
import { hint as Hint } from '@cryptoeconomicslab/ovm'
import {
  DoubleLayerInclusionProof,
  DoubleLayerTreeVerifier,
  DoubleLayerTreeLeaf
} from '@cryptoeconomicslab/merkle-tree'
import { Keccak256 } from '@cryptoeconomicslab/hash'
import { decodeStructable } from '@cryptoeconomicslab/coder'
import getTokenManager from '../managers/TokenManager'
import {
  StateUpdateRepository,
  SyncRepository,
  UserActionRepository
} from '../repository'
import { EmitterEvent, UserActionEvent } from '../ClientEvent'
import APIClient from '../APIClient'
import { createSendUserAction } from '../UserAction'
import { getOwner } from '../helper/stateUpdateHelper'

export class PendingStateUpdatesVerifier {
  constructor(
    private ee: EventEmitter,
    private witnessDb: KeyValueStore,
    private apiClient: APIClient
  ) {}

  /**
   * checks if pending state updates which basically are state updates client transfered,
   *  have been included in the block.
   * @param blockNumber block number to verify pending state updates
   */
  public async verify(blockNumber: BigNumber) {
    console.group('VERIFY PENDING STATE UPDATES: ', blockNumber.raw)
    const stateUpdateRepository = await StateUpdateRepository.init(
      this.witnessDb
    )

    const tokenManager = getTokenManager()
    tokenManager.depositContractAddresses.forEach(async addr => {
      const pendingStateUpdates = await stateUpdateRepository.getPendingStateUpdates(
        addr,
        new Range(BigNumber.from(0), BigNumber.MAX_NUMBER)
      )
      const verifier = new DoubleLayerTreeVerifier()
      const syncRepository = await SyncRepository.init(this.witnessDb)
      const root = await syncRepository.getBlockRoot(blockNumber)
      if (!root) {
        return
      }

      pendingStateUpdates.forEach(async su => {
        console.info(
          `Verify pended state update: (${su.range.start.data.toString()}, ${su.range.end.data.toString()})`
        )
        let res
        try {
          res = await this.apiClient.inclusionProof(su)
        } catch (e) {
          return
        }
        const { coder } = ovmContext
        const inclusionProof = decodeStructable(
          DoubleLayerInclusionProof,
          coder,
          Bytes.fromHexString(res.data.data)
        )
        const leaf = new DoubleLayerTreeLeaf(
          su.depositContractAddress,
          su.range.start,
          FixedBytes.from(
            32,
            Keccak256.hash(coder.encode(su.property.toStruct())).data
          )
        )
        if (verifier.verifyInclusion(leaf, su.range, root, inclusionProof)) {
          console.info(
            `Pended state update (${su.range.start.data.toString()}, ${su.range.end.data.toString()}) verified. remove from stateDB`
          )
          await stateUpdateRepository.removePendingStateUpdate(
            su.depositContractAddress,
            su.range
          )

          // store inclusionProof as witness
          const hint = Hint.createInclusionProofHint(
            blockNumber,
            su.depositContractAddress,
            su.range
          )
          await putWitness(
            this.witnessDb,
            hint,
            Bytes.fromHexString(res.data.data)
          )

          // store send user action
          const { range } = su
          const owner = getOwner(su)
          const tokenContractAddress = tokenManager.getTokenContractAddress(
            su.depositContractAddress
          )
          if (!tokenContractAddress)
            throw new Error('Token Contract Address not found')
          const actionRepository = await UserActionRepository.init(
            this.witnessDb
          )
          const action = createSendUserAction(
            Address.from(tokenContractAddress),
            range,
            owner,
            su.blockNumber
          )
          await actionRepository.insertAction(su.blockNumber, range, action)

          this.ee.emit(UserActionEvent.SEND, action)
          this.ee.emit(EmitterEvent.TRANSFER_COMPLETE, su)
        }
      })
    })
    console.groupEnd()
  }
}
