import {
  StateUpdate,
  Transaction,
  TransactionReceipt,
  Checkpoint,
  Exit
} from '@cryptoeconomicslab/plasma'
import {
  Property,
  CompiledPredicate,
  DeciderManager,
  DeciderConfig
} from '@cryptoeconomicslab/ovm'
import {
  Address,
  Bytes,
  BigNumber,
  Integer,
  Range
} from '@cryptoeconomicslab/primitives'
import {
  KeyValueStore,
  RangeDb,
  getWitnesses,
  putWitness,
  replaceHint
} from '@cryptoeconomicslab/db'
import {
  ICommitmentContract,
  IDepositContract,
  IERC20Contract,
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

import EventEmitter from 'event-emitter'
import {
  StateManager,
  SyncManager,
  CheckpointManager,
  DepositedRangeManager
} from './managers'
import APIClient from './APIClient'

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
  tokenContractFactory: (address: Address) => IERC20Contract
  commitmentContract: ICommitmentContract
  ownershipPayoutContract: IOwnershipPayoutContract
  deciderConfig: DeciderConfig
  aggregatorEndpoint?: string
}

export default class LightClient {
  private depositContracts: Map<string, IDepositContract> = new Map()
  private tokenContracts: Map<string, IERC20Contract> = new Map()
  private _syncing = false
  private ee = EventEmitter()
  private ownershipPredicate: CompiledPredicate
  private deciderManager: DeciderManager
  private apiClient: APIClient

  constructor(
    private wallet: Wallet,
    private witnessDb: KeyValueStore,
    private adjudicationContract: IAdjudicationContract,
    private depositContractFactory: (address: Address) => IDepositContract,
    private tokenContractFactory: (address: Address) => IERC20Contract,
    private commitmentContract: ICommitmentContract,
    private ownershipPayoutContract: IOwnershipPayoutContract,
    private stateManager: StateManager,
    private syncManager: SyncManager,
    private checkpointManager: CheckpointManager,
    private depositedRangeManager: DepositedRangeManager,
    deciderConfig: DeciderConfig,
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

  /**
   * get balance method
   * returns array of {tokenAddress: string, amount: number}
   */
  public async getBalance(): Promise<
    Array<{
      tokenAddress: string
      amount: number
    }>
  > {
    const addrs = Array.from(this.depositContracts.keys())
    const resultPromise = addrs.map(async addr => {
      const data = await this.stateManager.getVerifiedStateUpdates(
        Address.from(addr),
        new Range(BigNumber.from(0), BigNumber.from(10000)) // TODO: get all stateUpdate method
      )
      return {
        tokenAddress: addr,
        amount: data.reduce((p, s) => p + Number(s.amount), 0)
      }
    })
    return await Promise.all(resultPromise)
  }

  /**
   * start LiteClient process.
   */
  public async start() {
    this.commitmentContract.subscribeBlockSubmitted((blockNumber, root) => {
      console.log('new block submitted event:', root.toHexString())
      this.syncState(blockNumber, root)
      this.verifyPendingStateUpdates(blockNumber)
    })
    const blockNumber = await this.commitmentContract.getCurrentBlock()
    await this.syncStateUntill(blockNumber)
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
  private async syncState(blockNumber: BigNumber, root: Bytes) {
    this._syncing = true
    console.log(`syncing state: ${blockNumber}`)
    try {
      const res = await this.apiClient.syncState(this.address, blockNumber)
      const stateUpdates: StateUpdate[] = res.data.map((s: string) =>
        StateUpdate.fromProperty(
          decodeStructable(Property, ovmContext.coder, Bytes.fromHexString(s))
        )
      )
      const { coder } = ovmContext
      const promises = stateUpdates.map(async su => {
        const inclusionProof = await this.apiClient.inclusionProof(su)
        const hint = replaceHint(
          'proof.block${b}.range${token},RANGE,${range}',
          {
            b: coder.encode(blockNumber),
            token: coder.encode(su.depositContractAddress),
            range: coder.encode(su.range.toStruct())
          }
        )
        await putWitness(
          this.witnessDb,
          hint,
          Bytes.fromHexString(inclusionProof.data.data)
        )
        await this.stateManager.insertVerifiedStateUpdate(
          su.depositContractAddress,
          su
        )
      })
      await Promise.all(promises)
      await this.syncManager.updateSyncedBlockNumber(blockNumber, root)
      // TODO: fetch history proofs for unverified state update and verify them.
      this.ee.emit(EmitterEvent.SYNC_FINISHED, blockNumber)
    } catch (e) {
      console.log(e)
    } finally {
      this._syncing = false
    }
  }

  private async verifyPendingStateUpdates(blockNumber: BigNumber) {
    console.group('VERIFY PENDING STATE UPDATES: ', blockNumber)
    Object.keys(this.depositContracts).forEach(async addr => {
      const pendingStateUpdates = await this.stateManager.getPendingStateUpdates(
        Address.from(addr),
        new Range(BigNumber.from(0), BigNumber.from(10000))
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
        const res = await this.apiClient.inclusionProof(su)
        if (res.status === 404) {
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
          Keccak256.hash(coder.encode(su.property.toStruct()))
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
          const hint = replaceHint(
            'proof.block${b}.range${token},RANGE,${range}',
            {
              b: coder.encode(blockNumber),
              token: coder.encode(su.depositContractAddress),
              range: coder.encode(su.range.toStruct())
            }
          )
          await putWitness(
            this.witnessDb,
            hint,
            Bytes.fromHexString(res.data.data)
          )
          this.ee.emit(EmitterEvent.TRANSFER_COMPLETE, su)
        }
      })
    })
    console.groupEnd()
  }

  /**
   * Deposit given amount of given ERC20Contract's token to corresponding deposit contract.
   * @param amount amount to deposit
   * @param erc20ContractAddress ERC20 token address, undefined for ETH
   */
  public async deposit(amount: number, addr: string) {
    const erc20ContractAddress = Address.from(addr)
    const myAddress = this.wallet.getAddress()
    const depositContract = this.getDepositContract(erc20ContractAddress)
    const tokenContract = this.getTokenContract(erc20ContractAddress)
    // console.log('deposit: ', depositContract, tokenContract)
    if (!depositContract || !tokenContract) {
      throw new Error('Contract not found')
    }

    await tokenContract.approve(depositContract.address, Integer.from(amount))
    await depositContract.deposit(
      Integer.from(amount),
      this.ownershipProperty(myAddress)
    )
  }

  /**
   * transfer token to new owner. throw if given invalid inputs.
   * @param amount amount to transfer
   * @param depositContractAddress which token to transfer
   * @param to to whom transfer
   */
  public async transfer(
    amount: number,
    depositContractAddressString: string,
    toAddress: string
  ) {
    const depositContractAddress = Address.from(depositContractAddressString)
    const to = Address.from(toAddress)
    console.log('transfer :', amount, depositContractAddress, to)
    const stateUpdates = await this.stateManager.resolveStateUpdate(
      depositContractAddress,
      amount
    )
    if (stateUpdates === null) {
      throw new Error('Not enough amount')
    }

    const property = this.ownershipProperty(to)
    const latestBlock = await this.syncManager.getLatestSyncedBlockNumber()
    const transactions = await Promise.all(
      stateUpdates.map(async su => {
        const tx = new Transaction(
          depositContractAddress,
          su.range,
          BigNumber.from(JSBI.add(latestBlock.data, JSBI.BigInt(5))),
          property,
          this.wallet.getAddress()
        )
        const sig = await this.wallet.signMessage(
          ovmContext.coder.encode(tx.toProperty(Address.default()).toStruct())
        )
        tx.signature = sig
        return tx
      })
    )

    const res = await this.apiClient.sendTransaction(transactions)

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
   * given ERC20 deposit contract address, returns corresponding deposit contract.
   * @param erc20ContractAddress ERC20 contract address
   */
  private getDepositContract(
    erc20ContractAddress: Address
  ): IDepositContract | undefined {
    return this.depositContracts.get(erc20ContractAddress.data)
  }

  /**
   * given ERC20 deposit contract address, returns ERC20 contract instance.
   * @param erc20ContractAddress ERC20 contract address
   */
  private getTokenContract(
    erc20ContractAddress: Address
  ): IERC20Contract | undefined {
    return this.tokenContracts.get(erc20ContractAddress.data)
  }

  /**
   * register custom token.
   * @param erc20Contract IERC20Contract instance
   * @param depositContract IDepositContract instance
   */
  public registerCustomToken(
    erc20Contract: IERC20Contract,
    depositContract: IDepositContract
  ) {
    console.log('contracts set for token:', erc20Contract.address.data)
    const depositContractAddress = depositContract.address
    this.depositContracts.set(depositContractAddress.data, depositContract)
    this.tokenContracts.set(depositContractAddress.data, erc20Contract)

    depositContract.subscribeDepositedRangeExtended(async (range: Range) => {
      await this.depositedRangeManager.extendRange(
        depositContractAddress,
        range
      )
    })

    depositContract.subscribeDepositedRangeRemoved(async (range: Range) => {
      await this.depositedRangeManager.removeRange(
        depositContractAddress,
        range
      )
    })

    depositContract.subscribeCheckpointFinalized(
      async (checkpointId: Bytes, checkpoint: [Range, Property]) => {
        const c = new Checkpoint(checkpoint[0], checkpoint[1])
        await this.checkpointManager.insertCheckpoint(
          depositContractAddress,
          checkpointId,
          c
        )

        const stateUpdate = StateUpdate.fromProperty(checkpoint[1])
        const owner = this.getOwner(stateUpdate)
        if (owner && owner.data === this.wallet.getAddress().data) {
          await this.stateManager.insertVerifiedStateUpdate(
            depositContractAddress,
            stateUpdate
          )
        }
        this.ee.emit(
          EmitterEvent.CHECKPOINT_FINALIZED,
          checkpointId,
          checkpoint
        )
      }
    )
  }

  /**
   * register new ERC20 token
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
   * initiate exit process
   * @param amount amount to exit
   * @param address deposit contract address to exit
   */
  public async exit(amount: number, address: string) {
    const depositContractAddress = Address.from(address)
    const stateUpdates = await this.stateManager.resolveStateUpdate(
      depositContractAddress,
      amount
    )
    if (Array.isArray(stateUpdates) && stateUpdates.length > 0) {
      const predicate = this.deciderManager.compiledPredicateMap.get('Exit')
      if (!predicate) throw new Error('Exit predicate not found')
      const coder = ovmContext.coder
      await Promise.all(
        stateUpdates.map(async stateUpdate => {
          const hint = replaceHint(
            'proof.block${b}.range${token},RANGE,${range}',
            {
              b: coder.encode(stateUpdate.blockNumber),
              token: coder.encode(stateUpdate.depositContractAddress),
              range: coder.encode(stateUpdate.range.toStruct())
            }
          )
          const quantified = await getWitnesses(this.witnessDb, hint)
          if (quantified.length !== 1) {
            throw new Error('invalid range')
          }
          const proof = quantified[0]
          const exitProperty = predicate.makeProperty([
            coder.encode(stateUpdate.property.toStruct()),
            proof
          ])
          await this.adjudicationContract.claimProperty(exitProperty)
          const exitDb = new RangeDb(
            await this.witnessDb.bucket(Bytes.fromString('exit'))
          )
          const bucket = await exitDb.bucket(
            coder.encode(stateUpdate.depositContractAddress)
          )
          bucket.put(
            stateUpdate.range.start.data,
            stateUpdate.range.end.data,
            coder.encode(exitProperty.toStruct())
          )
          await this.stateManager.removeVerifiedStateUpdate(
            stateUpdate.depositContractAddress,
            stateUpdate.range
          )
          await this.stateManager.insertExitStateUpdate(
            stateUpdate.depositContractAddress,
            stateUpdate
          )
        })
      )
    } else {
      throw new Error('Insufficient amount')
    }
  }

  /**
   * finalize exit to withdraw token from deposit contract
   * @param exit Exit object to finalize
   */
  public async finalizeExit(exit: Exit) {
    const predicate = this.deciderManager.compiledPredicateMap.get('Exit')
    if (!predicate) throw new Error('Exit predicate not found')
    const exitProperty = exit.toProperty(predicate.deployedAddress)
    const decided = await this.adjudicationContract.isDecided(exit.id)
    if (!decided) {
      // TODO: who should decideClaim to true?
      try {
        await this.adjudicationContract.decideClaimToTrue(exit.id)
      } catch (e) {
        throw new Error(`Exit property is not decided: ${exit}`)
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

  public async getExitlist(): Promise<Exit[]> {
    const { coder } = ovmContext
    const exitDb = new RangeDb(
      await this.witnessDb.bucket(Bytes.fromString('exit'))
    )
    const exitList = await Promise.all(
      Array.from(this.depositContracts.keys()).map(async addr => {
        const bucket = await exitDb.bucket(coder.encode(Address.from(addr)))
        const iter = bucket.iter(JSBI.BigInt(0))
        let item = await iter.next()
        const result: Exit[] = []
        while (item !== null) {
          result.push(
            Exit.fromProperty(decodeStructable(Property, coder, item.value))
          )
          item = await iter.next()
        }
        return result
      })
    )
    return Array.prototype.concat.apply([], exitList)
  }

  // TODO: handling challenge game

  //
  // Events subscriptions
  //

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
