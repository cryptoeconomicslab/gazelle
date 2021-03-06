import JSBI from 'jsbi'
import {
  Address,
  Bytes,
  BigNumber,
  Property,
  Range
} from '@cryptoeconomicslab/primitives'
import {
  UnsignedTransaction,
  TransactionReceipt,
  StateUpdate
} from '@cryptoeconomicslab/plasma'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import { decodeStructable } from '@cryptoeconomicslab/coder'
import {
  StateUpdateRepository,
  SyncRepository,
  UserActionRepository
} from '../repository'
import TokenManager from '../managers/TokenManager'
import { Numberish } from '../types'
import { Wallet } from '@cryptoeconomicslab/wallet'
import APIClient from '../APIClient'
import { createSendUserAction } from '../UserAction'
import { getChunkId } from '../helper/stateUpdateHelper'

export class TransferUsecase {
  constructor(
    private witnessDb: KeyValueStore,
    private wallet: Wallet,
    private apiClient: APIClient,
    private tokenManager: TokenManager
  ) {}

  private mergeStateUpdates(stateUpdates: StateUpdate[]) {
    return stateUpdates.reduce(
      (mergedStateUpdates: StateUpdate[], su: StateUpdate) => {
        const lastSu = mergedStateUpdates.pop()
        if (lastSu === undefined) return [su]
        // resolveStateUpdate always returns StateUpdates in ascending order, so lastSu.end is less than su.start.
        if (lastSu.range.end.equals(su.range.start)) {
          lastSu.update({
            range: new Range(lastSu.range.start, su.range.end)
          })
          return mergedStateUpdates.concat([lastSu])
        } else {
          return mergedStateUpdates.concat([lastSu, su])
        }
      },
      []
    )
  }

  /**
   * send plasma transaction with amount, Deposit Contract address and StateObject.
   * @param amount amount of transaction
   * @param tokenContractAddress which token of transaction
   * @param stateObject property defining deprecate condition of next state
   */
  public async sendTransaction(
    amount: Numberish,
    tokenContractAddress: string,
    stateObject: Property
  ) {
    const { coder } = ovmContext
    const depositContractAddress = this.tokenManager.getDepositContractAddress(
      Address.from(tokenContractAddress)
    )
    if (!depositContractAddress) {
      throw new Error('Deposit Contract Address not found')
    }
    const stateUpdateRepository = await StateUpdateRepository.init(
      this.witnessDb
    )

    const stateUpdates = await stateUpdateRepository.resolveStateUpdate(
      Address.from(depositContractAddress),
      JSBI.BigInt(amount)
    )
    if (stateUpdates === null) {
      throw new Error('Not enough amount')
    }

    const syncRepository = await SyncRepository.init(this.witnessDb)
    const latestBlock = await syncRepository.getSyncedBlockNumber()

    // extract to helper: create chunkId from block number and range of first stateUpdate
    const chunkId = getChunkId(
      Address.from(depositContractAddress),
      latestBlock,
      stateUpdates[0].range.start
    )

    const transactions = await Promise.all(
      this.mergeStateUpdates(stateUpdates).map(async su => {
        const tx = new UnsignedTransaction(
          Address.from(depositContractAddress),
          su.range,
          BigNumber.from(JSBI.add(latestBlock.data, JSBI.BigInt(5))),
          stateObject,
          chunkId,
          this.wallet.getAddress()
        )
        return await tx.sign(this.wallet)
      })
    )

    let res
    try {
      res = await this.apiClient.sendTransaction(transactions)
    } catch (e) {
      console.log(e)
    }

    if (Array.isArray(res.data)) {
      const receipts = res.data.map(d => {
        return decodeStructable(
          TransactionReceipt,
          coder,
          Bytes.fromHexString(d)
        )
      })

      const nextBlock = await syncRepository.getNextBlockNumber()
      // TODO: is this valid handling?
      for await (const receipt of receipts) {
        if (receipt.status.data === 1) {
          for await (const su of stateUpdates) {
            await stateUpdateRepository.removeVerifiedStateUpdate(
              su.depositContractAddress,
              su.range
            )
            await stateUpdateRepository.insertPendingStateUpdate(su)
          }
        } else {
          throw new Error('Invalid transaction')
        }
      }

      const ranges = stateUpdates.map(su => su.range)
      const to = stateUpdates[0].stateObject.inputs[0]
      const userActionRepo = await UserActionRepository.init(this.witnessDb)
      const action = createSendUserAction(
        Address.from(tokenContractAddress),
        ranges,
        coder.decode(Address.default(), to),
        nextBlock,
        chunkId
      )
      await userActionRepo.insertAction(nextBlock, ranges[0], action)
    }
  }
}
