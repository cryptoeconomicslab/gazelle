import {
  StateUpdate,
  Transaction,
  TransactionReceipt,
  Checkpoint,
  IExit,
  Exit,
  ExitDeposit,
  PlasmaContractConfig
} from '@cryptoeconomicslab/plasma'
import {
  Property,
  CompiledPredicate,
  DeciderManager,
  DeciderConfig,
  Challenge,
  hint as Hint
} from '@cryptoeconomicslab/ovm'
import {
  Address,
  Bytes,
  FixedBytes,
  BigNumber,
  Range
} from '@cryptoeconomicslab/primitives'
import {
  KeyValueStore,
  RangeDb,
  getWitnesses,
  putWitness,
  RangeStore
} from '@cryptoeconomicslab/db'
import {
  ICommitmentContract,
  IDepositContract,
  IERC20DetailedContract,
  IAdjudicationContract,
  IOwnershipPayoutContract
} from '@cryptoeconomicslab/contract'
import { Wallet } from '@cryptoeconomicslab/wallet'
import { decodeStructable } from '@cryptoeconomicslab/coder'
import {
  DoubleLayerInclusionProof,
  DoubleLayerTreeVerifier,
  DoubleLayerTreeLeaf
} from '@cryptoeconomicslab/merkle-tree'
import { Keccak256 } from '@cryptoeconomicslab/hash'
import JSBI from 'jsbi'
import UserAction, {
  createDepositUserAction,
  createExitUserAction,
  createReceiveUserAction,
  createSendUserAction,
  ActionType
} from './UserAction'

import EventEmitter from 'event-emitter'
import {
  StateManager,
  SyncManager,
  CheckpointManager,
  DepositedRangeManager
} from './managers'
import APIClient from './APIClient'
import TokenManager from './managers/TokenManager'
import { executeChallenge } from './helper/challenge'

type Numberish =
  | {
      toString(): string
    }
  | {
      valueOf: string | number
    }
  | {
      [Symbol.toPrimitive]
    }

enum UserActionEvent {
  DEPOSIT = 'DEPOSIT',
  SEND = 'SEND',
  RECIEVE = 'RECIEVE',
  EXIT = 'EXIT'
}

enum EmitterEvent {
  CHECKPOINT_FINALIZED = 'CHECKPOINT_FINALIZED',
  TRANSFER_COMPLETE = 'TRANSFER_COMPLETE',
  SYNC_FINISHED = 'SYNC_FINISHED',
  EXIT_FINALIZED = 'EXIT_FINALIZED'
}

interface LightClientOptions {
  wallet: Wallet
  witnessDb: KeyValueStore
  adjudicationContract: IAdjudicationContract
  depositContractFactory: (address: Address) => IDepositContract
  tokenContractFactory: (address: Address) => IERC20DetailedContract
  commitmentContract: ICommitmentContract
  ownershipPayoutContract: IOwnershipPayoutContract
  deciderConfig: DeciderConfig & PlasmaContractConfig
  aggregatorEndpoint?: string
}

export default class LightClient {
  private _syncing = false
  private ee = EventEmitter()
  private ownershipPredicate: CompiledPredicate
  private deciderManager: DeciderManager
  private apiClient: APIClient
  private tokenManager: TokenManager

  constructor(
    private wallet: Wallet,
    private witnessDb: KeyValueStore,
    private adjudicationContract: IAdjudicationContract,
    private depositContractFactory: (address: Address) => IDepositContract,
    private tokenContractFactory: (address: Address) => IERC20DetailedContract,
    private commitmentContract: ICommitmentContract,
    private ownershipPayoutContract: IOwnershipPayoutContract,
    private stateManager: StateManager,
    private syncManager: SyncManager,
    private checkpointManager: CheckpointManager,
    private depositedRangeManager: DepositedRangeManager,
    private deciderConfig: DeciderConfig & PlasmaContractConfig,
    private aggregatorEndpoint: string = 'http://localhost:3000'
  ) {
    this.deciderManager = new DeciderManager(witnessDb, ovmContext.coder)
    this.deciderManager.loadJson(deciderConfig)
    const ownershipPredicate = this.deciderManager.compiledPredicateMap.get(
      'Ownership'
    )
    if (ownershipPredicate === undefined) {
      throw new Error('Ownership not found')
    }
    this.ownershipPredicate = ownershipPredicate
    this.apiClient = new APIClient(this.aggregatorEndpoint)
    this.tokenManager = new TokenManager()
  }

  /**
   * Initialize Plasma Light Client by options
   * @param options LightClientOptions to instantiate LightClient
   */
  static async initilize(options: LightClientOptions): Promise<LightClient> {
    const witnessDb = options.witnessDb
    const stateDb = await witnessDb.bucket(Bytes.fromString('state'))
    const syncDb = await witnessDb.bucket(Bytes.fromString('sync'))
    const checkpointDb = await witnessDb.bucket(Bytes.fromString('checkpoint'))
    const depositedRangeDb = await witnessDb.bucket(
      Bytes.fromString('depositedRange')
    )
    return new LightClient(
      options.wallet,
      options.witnessDb,
      options.adjudicationContract,
      options.depositContractFactory,
      options.tokenContractFactory,
      options.commitmentContract,
      options.ownershipPayoutContract,
      new StateManager(stateDb),
      new SyncManager(syncDb),
      new CheckpointManager(checkpointDb),
      new DepositedRangeManager(new RangeDb(depositedRangeDb)),
      options.deciderConfig,
      options.aggregatorEndpoint
    )
  }

  public ownershipProperty(owner: Address): Property {
    return this.ownershipPredicate.makeProperty([
      ovmContext.coder.encode(owner)
    ])
  }

  /**
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

  public getOwner(stateUpdate: StateUpdate): Address {
    return ovmContext.coder.decode(
      Address.default(),
      stateUpdate.stateObject.inputs[0]
    )
  }

  public get address(): string {
    return this.wallet.getAddress().data
  }

  public get syncing(): boolean {
    return this.syncing
  }

  private async getExitDb(
    depositContractAddress: Address
  ): Promise<RangeStore> {
    const exitDb = new RangeDb(
      await this.witnessDb.bucket(Bytes.fromString('exit'))
    )
    const bucket = await exitDb.bucket(
      ovmContext.coder.encode(depositContractAddress)
    )
    return bucket
  }

  private async getClaimDb(): Promise<KeyValueStore> {
    return await this.witnessDb.bucket(Bytes.fromString('claimedProperty'))
  }

  private async getUserActionDb(blockNumber: BigNumber): Promise<RangeStore> {
    const db = await this.witnessDb.bucket(Bytes.fromString('userAction'))
    const bucket = await db.bucket(Bytes.fromString(blockNumber.raw))
    return new RangeDb(bucket)
  }

  /**
   * Get current balance of tokens in plasma.
   * All ERC20 tokens including Peth registered by `registerCustomToken` method or `registerToken` method are included.
   * @returns Array of balance object which has the amount you have and token information.
   *     e.g. For ETH, the unit of amount is "wei" and decimal is 18.
   */
  public async getBalance(): Promise<
    Array<{
      name: string
      symbol: string
      decimals: number
      amount: JSBI
      tokenContractAddress: string
    }>
  > {
    const resultPromise = this.tokenManager.tokenContractAddresses.map(
      async addr => {
        const depositContractAddress = this.tokenManager.getDepositContractAddress(
          addr
        )
        if (!depositContractAddress)
          throw new Error('Deposit Contract Address not found')
        const data = await this.stateManager.getVerifiedStateUpdates(
          Address.from(depositContractAddress),
          new Range(BigNumber.from(0), BigNumber.MAX_NUMBER) // TODO: get all stateUpdate method
        )
        return {
          name: this.tokenManager.getName(addr),
          symbol: this.tokenManager.getSymbol(addr),
          decimals: this.tokenManager.getDecimal(addr),
          amount: data.reduce((p, s) => JSBI.add(p, s.amount), JSBI.BigInt(0)),
          tokenContractAddress: addr.data
        }
      }
    )
    return await Promise.all(resultPromise)
  }

  /**
   * start LightClient process.
   */
  public async start() {
    this.commitmentContract.subscribeBlockSubmitted(
      async (blockNumber, root) => {
        console.log('new block submitted event:', root.toHexString())
        await this.syncState(blockNumber, root)
        await this.verifyPendingStateUpdates(blockNumber)
      }
    )
    this.commitmentContract.startWatchingEvents()
    const blockNumber = await this.commitmentContract.getCurrentBlock()
    await this.syncStateUntill(blockNumber)
    await this.watchAdjudicationContract()
  }

  /**
   * stop LightClient process
   */
  public stop() {
    this.adjudicationContract.unsubscribeAll()
    this.commitmentContract.unsubscribeAll()
    this.tokenManager.depositContractAddresses.forEach(async addr => {
      const depositContract = this.tokenManager.getDepositContract(addr)
      if (depositContract) {
        depositContract.unsubscribeAll()
      }
    })
  }

  /**
   * sync local state to given block number
   * @param blockNum block number to which client should sync
   */
  private async syncStateUntill(blockNum: BigNumber): Promise<void> {
    let synced = await this.syncManager.getLatestSyncedBlockNumber()
    console.log(`sync state from ${synced} to ${blockNum}`)
    if (JSBI.greaterThan(synced.data, blockNum.data)) {
      throw new Error('Synced state is greater than latest block')
    }

    while (JSBI.notEqual(synced.data, blockNum.data)) {
      synced = BigNumber.from(JSBI.add(synced.data, JSBI.BigInt(1)))
      const root = await this.commitmentContract.getRoot(synced)
      if (!root) {
        // FIXME: check if root is default bytes32 value
        throw new Error('Block root hash is null')
      }
      await this.syncState(synced, root)
    }
  }

  /**
   * fetch latest state from aggregator
   * update local database with new state updates.
   * @param blockNumber block number to sync state
   * @param root root hash of new block to be synced
   */
  private async syncState(blockNumber: BigNumber, root: FixedBytes) {
    this._syncing = true
    const { coder } = ovmContext
    console.log(`start syncing state: ${blockNumber.toString()}`)

    const rootHint = Hint.createRootHint(
      blockNumber,
      Address.from(this.deciderConfig.commitmentContract)
    )
    await putWitness(
      this.deciderManager.witnessDb,
      rootHint,
      coder.encode(root)
    )
    const storageDb = await this.deciderManager.getStorageDb()
    const bucket = await storageDb.bucket(
      ovmContext.coder.encode(
        Address.from(this.deciderConfig.commitmentContract)
      )
    )
    await bucket.put(coder.encode(blockNumber), coder.encode(root))

    try {
      const res = await this.apiClient.syncState(this.address, blockNumber)
      const stateUpdates: StateUpdate[] = res.data.map((s: string) =>
        StateUpdate.fromProperty(
          decodeStructable(Property, coder, Bytes.fromHexString(s))
        )
      )
      const promises = stateUpdates.map(async su => {
        try {
          const verified = await this.verifyStateUpdateHistory(su, blockNumber)
          if (!verified) return
        } catch (e) {
          console.log(e)
        }

        await this.stateManager.insertVerifiedStateUpdate(
          su.depositContractAddress,
          su
        )
        // store receive user action
        const { range } = su
        const owner = this.getOwner(su)
        const tokenContractAddress = this.tokenManager.getTokenContractAddress(
          su.depositContractAddress
        )
        if (!tokenContractAddress)
          throw new Error('Token Contract Address not found')
        const action = createReceiveUserAction(
          Address.from(tokenContractAddress),
          range,
          owner,
          su.blockNumber
        )
        const db = await this.getUserActionDb(su.blockNumber)
        await db.put(
          range.start.data,
          range.end.data,
          ovmContext.coder.encode(action.toStruct())
        )
        this.ee.emit(UserActionEvent.RECIEVE, action)
      })
      await Promise.all(promises)
      await this.syncManager.updateSyncedBlockNumber(blockNumber, root)
      this.ee.emit(EmitterEvent.SYNC_FINISHED, blockNumber)
      console.log(`Finish syncing state: ${blockNumber.toString()}`)
    } catch (e) {
      console.log(`Failed syncing state: ${blockNumber.toString()}`, e)
    } finally {
      this._syncing = false
    }
  }

  /**
   * checks if pending state updates which basically are state updates client transfered,
   *  have been included in the block.
   * @param blockNumber block number to verify pending state updates
   */
  private async verifyPendingStateUpdates(blockNumber: BigNumber) {
    console.group('VERIFY PENDING STATE UPDATES: ', blockNumber.raw)
    this.tokenManager.depositContractAddresses.forEach(async addr => {
      const pendingStateUpdates = await this.stateManager.getPendingStateUpdates(
        addr,
        new Range(BigNumber.from(0), BigNumber.MAX_NUMBER)
      )
      const verifier = new DoubleLayerTreeVerifier()
      const root = await this.syncManager.getRoot(blockNumber)
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
          await this.stateManager.removePendingStateUpdate(
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
          const owner = this.getOwner(su)
          const tokenContractAddress = this.tokenManager.getTokenContractAddress(
            su.depositContractAddress
          )
          if (!tokenContractAddress)
            throw new Error('Token Contract Address not found')
          const action = createSendUserAction(
            Address.from(tokenContractAddress),
            range,
            owner,
            su.blockNumber
          )
          const db = await this.getUserActionDb(su.blockNumber)
          await db.put(
            range.start.data,
            range.end.data,
            ovmContext.coder.encode(action.toStruct())
          )
          this.ee.emit(UserActionEvent.SEND, action)
          this.ee.emit(EmitterEvent.TRANSFER_COMPLETE, su)
        }
      })
    })
    console.groupEnd()
  }

  /**
   * verify the history of given state update by deciding checkpoint property
   * @param stateUpdate stateUpdate to verify history
   * @param blockNumber blockNumber of the stateUpdate
   */
  private async verifyStateUpdateHistory(
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
        ovmContext.coder,
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

      const witnessDb = this.deciderManager.witnessDb
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
            const txPropertyBytes = ovmContext.coder.encode(
              Transaction.fromStruct(
                ovmContext.coder.decode(Transaction.getParamTypes(), txBytes)
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
    const decision = await this.deciderManager.decide(checkpointProperty)
    return decision.outcome
  }

  /**
   * create exit property from StateUpdate
   * If a checkpoint that is same range and block as `stateUpdate` exists, return exitDeposit property.
   * If inclusion proof for `stateUpdate` exists, return exit property.
   * otherwise throw exception
   * @param stateUpdate
   */
  private async createExit(stateUpdate: StateUpdate): Promise<IExit> {
    const exitPredicate = this.deciderManager.compiledPredicateMap.get('Exit')
    const exitDepositPredicate = this.deciderManager.compiledPredicateMap.get(
      'ExitDeposit'
    )
    if (!exitPredicate) throw new Error('Exit predicate not found')
    if (!exitDepositPredicate)
      throw new Error('ExitDeposit predicate not found')

    const { coder } = ovmContext
    const inputsOfExitProperty = [coder.encode(stateUpdate.property.toStruct())]
    const checkpoints = await this.checkpointManager.getCheckpointsWithRange(
      stateUpdate.depositContractAddress,
      stateUpdate.range
    )
    if (checkpoints.length > 0) {
      const checkpointStateUpdate = StateUpdate.fromProperty(
        checkpoints[0].stateUpdate
      )
      // check stateUpdate is subrange of checkpoint
      if (
        checkpointStateUpdate.depositContractAddress.data ===
          stateUpdate.depositContractAddress.data &&
        JSBI.equal(
          checkpointStateUpdate.blockNumber.data,
          stateUpdate.blockNumber.data
        )
      ) {
        // making exitDeposit property
        inputsOfExitProperty.push(
          coder.encode(checkpoints[0].property.toStruct())
        )
        return ExitDeposit.fromProperty(
          exitDepositPredicate.makeProperty(inputsOfExitProperty)
        )
      }
    }
    // making exit property
    const hint = Hint.createInclusionProofHint(
      stateUpdate.blockNumber,
      stateUpdate.depositContractAddress,
      stateUpdate.range
    )
    const quantified = await getWitnesses(this.witnessDb, hint)

    if (quantified.length !== 1) {
      throw new Error('invalid range')
    }
    const proof = quantified[0]
    inputsOfExitProperty.push(proof)
    return Exit.fromProperty(exitPredicate.makeProperty(inputsOfExitProperty))
  }

  /**
   * create exit object from Property
   * @param property
   */
  private createExitFromProperty(property: Property): IExit | null {
    if (
      property.deciderAddress.equals(
        this.deciderManager.getDeciderAddress('Exit')
      )
    ) {
      return Exit.fromProperty(property)
    } else if (
      property.deciderAddress.equals(
        this.deciderManager.getDeciderAddress('ExitDeposit')
      )
    ) {
      return ExitDeposit.fromProperty(property)
    }
    return null
  }

  /**
   * Deposit given amount of token to corresponding deposit contract.
   * this method calls `approve` method of ERC20 contract and `deposit` method
   * of Deposit contract.
   * @param amount amount to deposit
   * @param tokenContractAddress contract address of the token
   */
  public async deposit(amount: Numberish, tokenContractAddress: string) {
    const addr = Address.from(tokenContractAddress)
    const myAddress = this.wallet.getAddress()
    const erc20Contract = this.tokenManager.getTokenContract(addr)
    if (!erc20Contract) {
      throw new Error('Token Contract not found')
    }
    const depositContractAddress = this.tokenManager.getDepositContractAddress(
      addr
    )
    if (!depositContractAddress) {
      throw new Error('Deposit Contract Address not found')
    }
    const depositContract = this.tokenManager.getDepositContract(
      Address.from(depositContractAddress)
    )
    if (!depositContract) {
      throw new Error('Deposit Contract not found')
    }

    await erc20Contract.approve(
      depositContract.address,
      BigNumber.from(JSBI.BigInt(amount))
    )
    await depositContract.deposit(
      BigNumber.from(JSBI.BigInt(amount)),
      this.ownershipProperty(myAddress)
    )
  }

  /**
   * transfer token to new owner. throw if given invalid inputs.
   * @param amount amount to transfer
   * @param tokenContractAddress which token to transfer
   * @param to to whom transfer
   */
  public async transfer(
    amount: Numberish,
    tokenContractAddress: string,
    toAddress: string
  ) {
    console.log(
      'transfer :',
      amount.toString(),
      tokenContractAddress,
      toAddress
    )
    const to = Address.from(toAddress)
    const ownershipStateObject = this.ownershipProperty(to)
    await this.sendTransaction(
      amount,
      tokenContractAddress,
      ownershipStateObject
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
    const depositContractAddress = this.tokenManager.getDepositContractAddress(
      Address.from(tokenContractAddress)
    )
    if (!depositContractAddress) {
      throw new Error('Deposit Contract Address not found')
    }
    const stateUpdates = await this.stateManager.resolveStateUpdate(
      Address.from(depositContractAddress),
      JSBI.BigInt(amount)
    )
    if (stateUpdates === null) {
      throw new Error('Not enough amount')
    }

    const latestBlock = await this.syncManager.getLatestSyncedBlockNumber()
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
          ovmContext.coder.encode(tx.toProperty(Address.default()).toStruct())
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
          ovmContext.coder,
          Bytes.fromHexString(d)
        )
      })

      // TODO: is this valid handling?
      for await (const receipt of receipts) {
        if (receipt.status.data === 1) {
          for await (const su of stateUpdates) {
            await this.stateManager.removeVerifiedStateUpdate(
              su.depositContractAddress,
              su.range
            )
            await this.stateManager.insertPendingStateUpdate(
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

  /**
   * register ERC20 custom token.
   * ERC20 contract wrapper is passed directly. This method should be used
   * when you want to use custom IERC20 contract. PETH contract use this method.
   * @param erc20Contract IERC20Contract instance
   * @param depositContract IDepositContract instance
   */
  public async registerCustomToken(
    erc20Contract: IERC20DetailedContract,
    depositContract: IDepositContract
  ) {
    await this.tokenManager.addContracts(erc20Contract, depositContract)
    depositContract.subscribeDepositedRangeExtended(async (range: Range) => {
      await this.depositedRangeManager.extendRange(
        depositContract.address,
        range
      )
    })

    depositContract.subscribeDepositedRangeRemoved(async (range: Range) => {
      await this.depositedRangeManager.removeRange(
        depositContract.address,
        range
      )
    })

    depositContract.subscribeCheckpointFinalized(
      async (checkpointId: Bytes, checkpoint: [Property]) => {
        const checkpointPredicate = this.deciderManager.compiledPredicateMap.get(
          'Checkpoint'
        )
        if (!checkpointPredicate) {
          throw new Error('')
        }
        const c = new Checkpoint(
          checkpointPredicate.deployedAddress,
          checkpoint[0]
        )
        await this.checkpointManager.insertCheckpoint(
          depositContract.address,
          checkpointId,
          c
        )
        await this.checkpointManager.insertCheckpointWithRange(
          depositContract.address,
          c
        )

        const stateUpdate = StateUpdate.fromProperty(checkpoint[0])
        const owner = this.getOwner(stateUpdate)
        if (owner && owner.data === this.wallet.getAddress().data) {
          await this.stateManager.insertVerifiedStateUpdate(
            depositContract.address,
            stateUpdate
          )

          // put deposited action
          const { range, blockNumber } = stateUpdate
          const tokenContractAddress = this.tokenManager.getTokenContractAddress(
            depositContract.address
          )
          if (!tokenContractAddress)
            throw new Error('Token Contract Address not found')
          const action = createDepositUserAction(
            Address.from(tokenContractAddress),
            range,
            blockNumber
          )
          const db = await this.getUserActionDb(blockNumber)
          await db.put(
            range.start.data,
            range.end.data,
            ovmContext.coder.encode(action.toStruct())
          )
          this.ee.emit(UserActionEvent.DEPOSIT, action)
        }
        this.ee.emit(
          EmitterEvent.CHECKPOINT_FINALIZED,
          checkpointId,
          checkpoint
        )
      }
    )
    depositContract.startWatchingEvents()
  }

  /**
   * register ERC20 token.
   * use default ERC20 contract wrapper
   * @param erc20ContractAddress ERC20 token address to register
   * @param depositContractAddress deposit contract address connecting to tokenAddress above
   */
  public registerToken(
    erc20ContractAddress: string,
    depositContractAddress: string
  ) {
    const depositContract = this.depositContractFactory(
      Address.from(depositContractAddress)
    )
    const erc20Contract = this.tokenContractFactory(
      Address.from(erc20ContractAddress)
    )
    this.registerCustomToken(erc20Contract, depositContract)
  }

  /**
   * Withdrawal process starts from calling this method.
   * Given amount and tokenContractAddress, checks if client has sufficient token amount.
   * If client has sufficient amount, create exitProperty from stateUpdates this client owns,
   * calls `claimProperty` method on UniversalAdjudicationContract. Store the property in exitList.
   * User can call `completeWithdrawal` to withdraw actual token after the exitProperty is decided to true on-chain.
   * @param amount amount to exit
   * @param tokenContractAddress token contract address to exit
   */
  public async startWithdrawal(
    amount: Numberish,
    tokenContractAddress: string
  ) {
    const addr = Address.from(tokenContractAddress)
    const depositContractAddress = this.tokenManager.getDepositContractAddress(
      addr
    )
    if (!depositContractAddress) {
      throw new Error('Deposit Contract Address not found')
    }
    const stateUpdates = await this.stateManager.resolveStateUpdate(
      Address.from(depositContractAddress),
      JSBI.BigInt(amount)
    )
    if (Array.isArray(stateUpdates) && stateUpdates.length > 0) {
      // resolve promises in serial to avoid an error of ethers.js on calling claimProperty
      // "the tx doesn't have the correct nonce."
      for (const stateUpdate of stateUpdates) {
        const exit = await this.createExit(stateUpdate)
        await this.adjudicationContract.claimProperty(exit.property)
        await this.saveExit(exit)
      }
    } else {
      throw new Error('Insufficient amount')
    }
  }

  /**
   * Given exit instance, finalize exit to withdraw token from deposit contract.
   * Client checks if the exitProperty of the exit instance is decided by calling `isDecided` method
   * of UniversalAdjudicationContract. If the property claim have not been decided yet, call `decideClaimToTrue`.
   * If the exitProperty had been decided to true, call `finalizeExit` method of corresponding payout contract.
   *
   * @param exit Exit object to finalize
   */
  public async completeWithdrawal(exit: IExit) {
    const exitProperty = exit.property
    const decided = await this.adjudicationContract.isDecided(exit.id)
    if (!decided) {
      const decidable = await this.adjudicationContract.isDecidable(exit.id)
      if (decidable) {
        await this.adjudicationContract.decideClaimToTrue(exit.id)
        const db = await this.getClaimDb()
        await db.del(exit.id)
      } else {
        throw new Error('Exit property is not decidable')
      }
    }

    const depositedRangeId = await this.depositedRangeManager.getDepositedRangeId(
      exit.stateUpdate.depositContractAddress,
      exit.range
    )

    await this.ownershipPayoutContract.finalizeExit(
      exit.stateUpdate.depositContractAddress,
      exitProperty,
      depositedRangeId,
      Address.from(this.address)
    )

    this.ee.emit(EmitterEvent.EXIT_FINALIZED, exit.id)
  }

  /**
   * Get pending withdrawal list
   */
  public async getPendingWithdrawals(): Promise<IExit[]> {
    const { coder } = ovmContext
    const exitList = await Promise.all(
      this.tokenManager.depositContractAddresses.map(async addr => {
        const exitDb = await this.getExitDb(addr)
        const iter = exitDb.iter(JSBI.BigInt(0))
        let item = await iter.next()
        const result: IExit[] = []
        while (item !== null) {
          const p = decodeStructable(Property, coder, item.value)
          const exit = this.createExitFromProperty(p)
          if (exit) {
            result.push(exit)
          }
          item = await iter.next()
        }
        return result
      })
    )
    return Array.prototype.concat.apply([], exitList)
  }

  /**
   * @name executeChallenge
   * @description execute challenge procedure to game with challenge property
   * @param gameId Id of the game to challenge
   * @param challenge challenge data structure
   */
  private async executeChallenge(property: Property, challenge: Challenge) {
    await executeChallenge(
      this.adjudicationContract,
      this.deciderManager,
      property,
      challenge
    )
  }

  private async watchAdjudicationContract() {
    this.adjudicationContract.subscribeClaimChallenged(
      async (gameId, challengeGameId) => {
        const db = await this.getClaimDb()
        const propertyBytes = await db.get(gameId)
        const challengingPropertyBytes = await db.get(challengeGameId)
        if (propertyBytes && challengingPropertyBytes) {
          // challenged property is the one this client claimed
          const challengeProperty = decodeStructable(
            Property,
            ovmContext.coder,
            challengingPropertyBytes
          )
          const decision = await this.deciderManager.decide(challengeProperty)
          if (!decision.outcome && decision.challenge) {
            // challenge again
            await this.executeChallenge(challengeProperty, decision.challenge)
          }
        }
      }
    )

    this.adjudicationContract.subscribeNewPropertyClaimed(
      async (gameId, property, createdBlock) => {
        console.log(
          'property is claimed',
          gameId.toHexString(),
          property.deciderAddress.data,
          createdBlock
        )
        const claimDb = await this.getClaimDb()
        await claimDb.put(gameId, ovmContext.coder.encode(property.toStruct()))

        const exit = this.createExitFromProperty(property)
        if (exit) {
          console.log('Exit property claimed')
          const { range, depositContractAddress } = exit.stateUpdate

          // TODO: implement general way to check if client should challenge claimed property.
          const stateUpdates = await this.stateManager.getVerifiedStateUpdates(
            depositContractAddress,
            range
          )
          if (stateUpdates.length > 0) {
            const decision = await this.deciderManager.decide(property)
            if (this.getOwner(exit.stateUpdate).data === this.address) {
              // exit initiated with this client. save exit into db
              await this.saveExit(exit)
            } else if (!decision.outcome && decision.challenge) {
              // exit is others. need to challenge
              const challenge = decision.challenge
              await this.executeChallenge(property, challenge)
            }
          }
        }
      }
    )

    this.adjudicationContract.subscribeClaimDecided(
      async (gameId, decision) => {
        const db = await this.getClaimDb()
        await db.del(gameId)
      }
    )

    this.adjudicationContract.startWatchingEvents()
  }

  private async saveExit(exit: IExit) {
    const { coder } = ovmContext
    const stateUpdate = exit.stateUpdate
    const propertyBytes = coder.encode(exit.property.toStruct())
    const exitDb = await this.getExitDb(stateUpdate.depositContractAddress)
    await exitDb.put(
      stateUpdate.range.start.data,
      stateUpdate.range.end.data,
      propertyBytes
    )
    await this.stateManager.removeVerifiedStateUpdate(
      stateUpdate.depositContractAddress,
      stateUpdate.range
    )
    await this.stateManager.insertExitStateUpdate(
      stateUpdate.depositContractAddress,
      stateUpdate
    )
    const id = Keccak256.hash(propertyBytes)
    const claimDb = await this.getClaimDb()
    await claimDb.put(id, propertyBytes)

    // put exit action
    const { range } = stateUpdate
    const blockNumber = await this.commitmentContract.getCurrentBlock()
    const tokenContractAddress = this.tokenManager.getTokenContractAddress(
      stateUpdate.depositContractAddress
    )
    if (!tokenContractAddress)
      throw new Error('Token Contract Address not found')
    const action = createExitUserAction(
      Address.from(tokenContractAddress),
      range,
      blockNumber
    )
    const db = await this.getUserActionDb(blockNumber)
    await db.put(
      range.start.data,
      range.end.data,
      ovmContext.coder.encode(action.toStruct())
    )
    this.ee.emit(UserActionEvent.EXIT, action)
  }

  /**
   * get all user actions until currentBlockNumber
   */
  public async getAllUserActions(): Promise<UserAction[]> {
    let result: UserAction[] = []
    const currentBlockNumber = await this.commitmentContract.getCurrentBlock()
    let blockNumber = JSBI.BigInt(0)
    while (JSBI.lessThanOrEqual(blockNumber, currentBlockNumber.data)) {
      const actions = await this.getUserActions(BigNumber.from(blockNumber))
      result = result.concat(actions)
      blockNumber = JSBI.add(blockNumber, JSBI.BigInt(1))
    }
    return result
  }

  /**
   * get user actions at given blockNumber
   * @param blockNumber blockNumber to get userAction
   */
  private async getUserActions(blockNumber: BigNumber): Promise<UserAction[]> {
    const bucket = await this.getUserActionDb(blockNumber)
    const iter = bucket.iter(JSBI.BigInt(0))
    let item = await iter.next()
    const result: UserAction[] = []
    while (item !== null) {
      result.push(
        UserAction.fromStruct(
          ovmContext.coder.decode(UserAction.getParamTypes(), item.value)
        )
      )
      item = await iter.next()
    }
    return result
  }

  //
  // Store witnesses
  //
  private async storeStateUpdates(stateUpdates: StateUpdate[]) {
    const { coder } = ovmContext
    await Promise.all(
      stateUpdates.map(async su => {
        await putWitness(
          this.deciderManager.witnessDb,
          Hint.createStateUpdateHint(
            su.blockNumber,
            su.depositContractAddress,
            su.range
          ),
          coder.encode(su.property.toStruct())
        )
      })
    )
  }

  //
  // Events subscriptions
  //

  public subscribeDepositEvent(handler: (action: UserAction) => void) {
    this.ee.on(UserActionEvent.DEPOSIT, handler)
  }

  public subscribeSendEvent(handler: (action: UserAction) => void) {
    this.ee.on(UserActionEvent.SEND, handler)
  }

  public subscribeRecieveEvent(handler: (action: UserAction) => void) {
    this.ee.on(UserActionEvent.RECIEVE, handler)
  }

  public subscribeExitEvent(handler: (action: UserAction) => void) {
    this.ee.on(UserActionEvent.EXIT, handler)
  }

  public subscribeCheckpointFinalized(
    handler: (checkpointId: Bytes, checkpoint: [Range, Property]) => void
  ) {
    this.ee.on(EmitterEvent.CHECKPOINT_FINALIZED, handler)
  }

  public subscribeSyncFinished(handler: (blockNumber: BigNumber) => void) {
    this.ee.on(EmitterEvent.SYNC_FINISHED, handler)
  }

  public subscribeTransferComplete(handler: (su: StateUpdate) => void) {
    this.ee.on(EmitterEvent.TRANSFER_COMPLETE, handler)
  }

  public subscribeExitFinalized(handler: (exitId: Bytes) => void) {
    this.ee.on(EmitterEvent.EXIT_FINALIZED, handler)
  }

  public unsubscribeCheckpointFinalized(
    handler: (checkpointId: Bytes, checkpoint: [Range, Property]) => void
  ) {
    this.ee.off(EmitterEvent.CHECKPOINT_FINALIZED, handler)
  }

  public unsubscribeSyncFinished(handler: (blockNumber: BigNumber) => void) {
    this.ee.off(EmitterEvent.SYNC_FINISHED, handler)
  }

  public unsubscribeTransferComplete(handler: (su: StateUpdate) => void) {
    this.ee.off(EmitterEvent.TRANSFER_COMPLETE, handler)
  }

  public unsubscribeExitFinalized(handler: (exitId: Bytes) => void) {
    this.ee.off(EmitterEvent.EXIT_FINALIZED, handler)
  }
}
