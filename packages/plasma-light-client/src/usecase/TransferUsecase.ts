import JSBI from 'jsbi'
import {
  Address,
  Bytes,
  BigNumber,
  Property
} from '@cryptoeconomicslab/primitives'
import { Transaction, TransactionReceipt } from '@cryptoeconomicslab/plasma'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import { decodeStructable } from '@cryptoeconomicslab/coder'
import { StateUpdateRepository, SyncRepository } from '../repository'
import TokenManager from '../managers/TokenManager'
import { Numberish } from '../types'
import { Wallet } from '@cryptoeconomicslab/wallet'
import APIClient from '../APIClient'

export class TransferUsecase {
  constructor(
    private witnessDb: KeyValueStore,
    private wallet: Wallet,
    private apiClient: APIClient,
    private tokenManager: TokenManager
  ) {}

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
    const transactions = await Promise.all(
      stateUpdates.map(async su => {
        const tx = new Transaction(
          Address.from(depositContractAddress),
          su.range,
          BigNumber.from(JSBI.add(latestBlock.data, JSBI.BigInt(5))),
          stateObject,
          this.wallet.getAddress()
        )
        const sig = await this.wallet.signMessage(
          coder.encode(tx.toProperty(Address.default()).toStruct())
        )
        tx.signature = sig
        return tx
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

      // TODO: is this valid handling?
      for await (const receipt of receipts) {
        if (receipt.status.data === 1) {
          for await (const su of stateUpdates) {
            await stateUpdateRepository.removeVerifiedStateUpdate(
              su.depositContractAddress,
              su.range
            )
            await stateUpdateRepository.insertPendingStateUpdate(
              su.depositContractAddress,
              su
            )
          }
        } else {
          throw new Error('Invalid transaction')
        }
      }
    }
  }
}
