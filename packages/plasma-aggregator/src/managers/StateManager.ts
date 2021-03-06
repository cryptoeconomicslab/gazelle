import {
  StateUpdate,
  StateUpdateWithFrom,
  SignedTransaction,
  IncludedTransaction,
  DepositTransaction,
  verifyTransaction
} from '@cryptoeconomicslab/plasma'
import { DeciderManager, hint } from '@cryptoeconomicslab/ovm'
import {
  Bytes,
  Address,
  BigNumber,
  Range
} from '@cryptoeconomicslab/primitives'
import {
  RangeStore,
  KeyValueStore,
  putWitness,
  getWitnesses
} from '@cryptoeconomicslab/db'
import JSBI from 'jsbi'
import { createSignatureHint } from '@cryptoeconomicslab/ovm/lib/hintString'

/**
 * StateManager stores the latest states
 */
export default class StateManager {
  constructor(private db: RangeStore) {}

  public async resolveStateUpdatesAtBlock(
    address: Address,
    blockNumber: BigNumber,
    start: BigNumber,
    end: BigNumber
  ): Promise<StateUpdateWithFrom[]> {
    const { coder } = ovmContext
    const bucket = await this.db.bucket(Bytes.fromString('SU_AT_BLOCK'))
    const addressBucket = await bucket.bucket(Bytes.fromHexString(address.data))
    const blockBucket = await addressBucket.bucket(coder.encode(blockNumber))
    return (await blockBucket.get(start.data, end.data)).map(
      StateUpdateWithFrom.fromRangeRecord
    )
  }

  public async resolveStateUpdates(
    address: Address,
    start: BigNumber,
    end: BigNumber
  ): Promise<StateUpdateWithFrom[]> {
    const bucket = await this.db.bucket(Bytes.fromHexString(address.data))
    return (await bucket.get(start.data, end.data)).map(
      StateUpdateWithFrom.fromRangeRecord
    )
  }

  private async putStateUpdate(su: StateUpdateWithFrom) {
    const bucket = await this.db.bucket(
      Bytes.fromHexString(su.depositContractAddress.data)
    )
    await bucket.put(
      su.range.start.data,
      su.range.end.data,
      ovmContext.coder.encode(su.toRecord().toStruct())
    )
  }

  private async putStateUpdateAtBlock(
    su: StateUpdateWithFrom,
    blockNumber: BigNumber
  ) {
    const { coder } = ovmContext
    const bucket = await this.db.bucket(Bytes.fromString('SU_AT_BLOCK'))
    const addressBucket = await bucket.bucket(
      Bytes.fromHexString(su.depositContractAddress.data)
    )
    const blockBucket = await addressBucket.bucket(coder.encode(blockNumber))
    await blockBucket.put(
      su.range.start.data,
      su.range.end.data,
      ovmContext.coder.encode(su.toRecord().toStruct())
    )
  }

  /**
   * TODO: Fix implementation
   * given transaction, execute state transition on
   * existing state updates with gaiven range and returns new state update.
   * if transaction is invalid, throws.
   * @param tx transaction
   * @param nextBlockNumber next block number
   * @param deciderManager decider manager
   */
  public async executeStateTransition(
    tx: SignedTransaction,
    nextBlockNumber: BigNumber,
    deciderManager: DeciderManager
  ): Promise<StateUpdateWithFrom> {
    console.log('execute state transition')
    const range = tx.range
    const prevStates = await this.resolveStateUpdates(
      tx.depositContractAddress,
      range.start,
      range.end
    )

    if (prevStates.length === 0) {
      throw new Error('InvalidTransaction')
    }

    // if multiple prevStates found but they're not contigious
    const contigious = prevStates.reduce(
      ({ prevEnd, result }, current) => {
        if (!result) return { prevEnd, result }
        return {
          prevEnd: current.range.end,
          result: JSBI.equal(prevEnd.data, current.range.start.data)
        }
      },
      { prevEnd: prevStates[0].range.start, result: true }
    ).result

    if (!contigious) {
      throw new Error('InvalidTransaction')
    }

    // update intersected ranges
    if (JSBI.lessThan(prevStates[0].range.start.data, tx.range.start.data)) {
      prevStates[0].update({
        range: new Range(tx.range.start, prevStates[0].range.end)
      })
    }

    const last = prevStates.length - 1
    if (JSBI.greaterThan(prevStates[last].range.end.data, tx.range.end.data)) {
      prevStates[last].update({
        range: new Range(prevStates[last].range.start, tx.range.end)
      })
    }

    console.log('store witness tx')
    await this.storeWitness(
      deciderManager.witnessDb,
      tx,
      prevStates.map(s => s.blockNumber),
      prevStates.map(s => s.range)
    )

    // TODO: fix decision
    console.log('decide state transition')
    const decisions = await Promise.all(
      prevStates.map(async su =>
        this.verifyStateTransition(su.toStateUpdate(), tx, deciderManager)
      )
    )

    if (decisions.some(d => !d.outcome)) {
      throw new Error('InvalidTransaction')
    }

    const nextStateUpdate = new StateUpdateWithFrom(
      tx.depositContractAddress,
      tx.range,
      nextBlockNumber,
      tx.stateObject,
      tx.chunkId,
      tx.from
    )

    console.log('store tx data')
    // store data in db
    await this.storeTx(
      IncludedTransaction.fromSignedTransaction(tx, nextBlockNumber),
      prevStates.map(su => su.toStateUpdate())
    )
    await this.putStateUpdate(nextStateUpdate)
    await this.putStateUpdateAtBlock(nextStateUpdate, nextBlockNumber)
    return nextStateUpdate
  }

  private async verifyStateTransition(
    su: StateUpdate,
    tx: SignedTransaction,
    deciderManager: DeciderManager
  ): Promise<{ outcome: boolean }> {
    const txVerified = verifyTransaction(su, tx) // use verifyTransaction same as lightClient
    if (!txVerified) {
      return { outcome: false }
    }
    const message = tx.message
    const sig = await getWitnesses(
      deciderManager.witnessDb,
      createSignatureHint(message)
    )
    const result = await deciderManager.decide(
      su.stateObject.appendInput([message, ...sig])
    )

    return { outcome: result.outcome }
  }

  /**
   * insert a range into state db when deposited
   * @param tx deposit transaction
   * @param blockNumber block number at which coin range is added
   */
  public async insertDepositRange(
    tx: DepositTransaction,
    blockNumber: BigNumber
  ) {
    console.log('Deposited: ', tx.stateUpdate.toString())
    const stateUpdate = tx.stateUpdate
    stateUpdate.update({ blockNumber })
    const suWithFrom = stateUpdate.withFrom(Address.default())
    await this.putStateUpdate(suWithFrom)
    await this.putStateUpdateAtBlock(suWithFrom, blockNumber)
  }

  /**
   * query ownership state updates
   * @param addr owner address
   */
  public async queryOwnershipyStateUpdates(
    depositContractAddress: Address,
    ownershipPredicateAddress: Address,
    addr: Address,
    blockNumber?: BigNumber
  ) {
    return (
      await this.resolveStateUpdates(
        depositContractAddress,
        BigNumber.from(JSBI.BigInt(0)),
        BigNumber.MAX_NUMBER
      )
    )
      .filter(su =>
        blockNumber ? JSBI.equal(su.blockNumber.data, blockNumber.data) : true
      )
      .filter(su => {
        const owner = ovmContext.coder.decode(
          Address.default(),
          su.stateObject.inputs[0]
        )
        return (
          su.stateObject.deciderAddress.data ==
            ownershipPredicateAddress.data && owner.data === addr.data
        )
      })
  }

  // TODO: use repository

  /**
   * store transaction and signature to witness database
   * @param witnessDb witness database
   * @param tx signed transaction data
   */
  private async storeWitness(
    witnessDb: KeyValueStore,
    tx: SignedTransaction,
    prevBlockNumbers: BigNumber[],
    prevStateRanges: Range[]
  ) {
    for await (const [index, prevBlockNumber] of prevBlockNumbers.entries()) {
      const message = tx.message

      await putWitness(
        witnessDb,
        hint.createSignatureHint(message),
        tx.signature
      )
      await putWitness(
        witnessDb,
        hint.createTxHint(
          prevBlockNumber,
          tx.depositContractAddress,
          prevStateRanges[index]
        ),
        message
      )
    }
  }

  public async getTxs(
    depositContractAddress: Address,
    blockNumber: BigNumber,
    range: Range
  ) {
    const { coder } = ovmContext
    const txBucket = await this.db.bucket(Bytes.fromString('TX'))
    const blockBucket = await txBucket.bucket(coder.encode(blockNumber))
    const addrBucket = await blockBucket.bucket(
      Bytes.fromHexString(depositContractAddress.data)
    )
    const ranges = await addrBucket.get(range.start.data, range.end.data)
    return ranges.map(r =>
      IncludedTransaction.fromStruct(
        ovmContext.coder.decode(IncludedTransaction.getParamType(), r.value)
      )
    )
  }

  private async storeTx(
    tx: IncludedTransaction,
    deprecatedStates: StateUpdate[]
  ) {
    const { coder } = ovmContext
    const txBucket = await this.db.bucket(Bytes.fromString('TX'))
    for (const su of deprecatedStates) {
      const blockBucket = await txBucket.bucket(coder.encode(su.blockNumber))
      const addrBucket = await blockBucket.bucket(
        Bytes.fromHexString(su.depositContractAddress.data)
      )
      await addrBucket.put(
        su.range.start.data,
        su.range.end.data,
        coder.encode(tx.toStruct())
      )
    }
  }
}
