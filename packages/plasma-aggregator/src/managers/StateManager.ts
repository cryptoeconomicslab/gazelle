import {
  StateUpdate,
  Transaction,
  DepositTransaction
} from '@cryptoeconomicslab/plasma'
import {
  DeciderManager,
  Property,
  CompiledPredicate,
  hint
} from '@cryptoeconomicslab/ovm'
import {
  Bytes,
  Address,
  BigNumber,
  Range
} from '@cryptoeconomicslab/primitives'
import { RangeStore, KeyValueStore, putWitness } from '@cryptoeconomicslab/db'
import JSBI from 'jsbi'

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
  ): Promise<StateUpdate[]> {
    const { coder } = ovmContext
    const bucket = await this.db.bucket(Bytes.fromString('SU_AT_BLOCK'))
    const addressBucket = await bucket.bucket(Bytes.fromHexString(address.data))
    const blockBucket = await addressBucket.bucket(coder.encode(blockNumber))
    return (await blockBucket.get(start.data, end.data)).map(
      StateUpdate.fromRangeRecord
    )
  }

  public async resolveStateUpdates(
    address: Address,
    start: BigNumber,
    end: BigNumber
  ): Promise<StateUpdate[]> {
    const bucket = await this.db.bucket(Bytes.fromHexString(address.data))
    return (await bucket.get(start.data, end.data)).map(
      StateUpdate.fromRangeRecord
    )
  }

  private async putStateUpdate(su: StateUpdate) {
    const bucket = await this.db.bucket(
      Bytes.fromHexString(su.depositContractAddress.data)
    )
    await bucket.put(
      su.range.start.data,
      su.range.end.data,
      ovmContext.coder.encode(su.toRecord().toStruct())
    )
  }

  private async putStateUpdateAtBlock(su: StateUpdate, blockNumber: BigNumber) {
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
   * given transaction, execute state transition on
   * existing state updates with gaiven range and returns new state update.
   * if transaction is invalid, throws.
   * @param tx transaction
   * @param nextBlockNumber next block number
   * @param deciderManager decider manager
   */
  public async executeStateTransition(
    tx: Transaction,
    nextBlockNumber: BigNumber,
    deciderManager: DeciderManager
  ): Promise<StateUpdate> {
    console.log('execute state transition', tx.range)
    const { coder } = ovmContext
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

    await this.storeWitness(
      deciderManager.witnessDb,
      tx,
      prevStates.map(s => s.blockNumber),
      prevStates.map(s => s.range)
    )

    const decisions = await Promise.all(
      prevStates.map(async state => {
        return await deciderManager.decide(state.property)
      })
    )

    decisions.map(d => console.log(d.traceInfo?.toJson()))

    if (decisions.some(d => !d.outcome)) {
      throw new Error('InvalidTransaction')
    }

    const inputs: Bytes[] = [
      tx.depositContractAddress,
      tx.range.toStruct(),
      nextBlockNumber,
      tx.stateObject.toStruct(),
      tx.range.toStruct()
    ].map(coder.encode)

    const nextStateUpdate = StateUpdate.fromProperty(
      new Property(
        (deciderManager.compiledPredicateMap.get(
          'StateUpdate'
        ) as CompiledPredicate).deployedAddress,
        inputs
      )
    )

    // store data in db
    await this.storeTx(
      tx,
      nextStateUpdate,
      prevStates.map(s => s.blockNumber)
    )
    await this.putStateUpdate(nextStateUpdate)
    await this.putStateUpdateAtBlock(nextStateUpdate, nextBlockNumber)
    return nextStateUpdate
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
    console.log('insertDepositRange: ', tx)
    const stateUpdate = StateUpdate.fromProperty(tx.stateUpdate)
    stateUpdate.update({ blockNumber })
    await this.putStateUpdate(stateUpdate)
    await this.putStateUpdateAtBlock(stateUpdate, blockNumber)
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

  /**
   * store transaction and signature to witness database
   * @param witnessDb witness database
   * @param tx transaction data
   */
  private async storeWitness(
    witnessDb: KeyValueStore,
    tx: Transaction,
    prevBlockNumbers: BigNumber[],
    prevStateRanges: Range[]
  ) {
    for await (const [index, prevBlockNumber] of prevBlockNumbers.entries()) {
      const message = ovmContext.coder.encode(
        tx.toProperty(Address.default()).toStruct()
      )
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

  public async getTx(
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
    if (ranges.length == 0) return null
    return Transaction.fromStruct(
      ovmContext.coder.decode(Transaction.getParamTypes(), ranges[0].value)
    )
  }

  private async storeTx(
    tx: Transaction,
    su: StateUpdate,
    blockNumberOfDeprecatedStates: BigNumber[]
  ) {
    const { coder } = ovmContext
    const txBucket = await this.db.bucket(Bytes.fromString('TX'))
    for (const b of blockNumberOfDeprecatedStates) {
      const blockBucket = await txBucket.bucket(coder.encode(b))
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
