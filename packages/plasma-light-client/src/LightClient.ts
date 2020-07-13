import {
  StateUpdate,
  Checkpoint,
  IExit,
  PlasmaContractConfig
} from '@cryptoeconomicslab/plasma'
import {
  CompiledPredicate,
  DeciderManager,
  DeciderConfig,
  Challenge
} from '@cryptoeconomicslab/ovm'
import {
  Address,
  Bytes,
  BigNumber,
  Property,
  Range
} from '@cryptoeconomicslab/primitives'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import {
  ICommitmentContract,
  IDepositContract,
  IERC20DetailedContract,
  IAdjudicationContract,
  IOwnershipPayoutContract
} from '@cryptoeconomicslab/contract'
import { Wallet } from '@cryptoeconomicslab/wallet'
import { decodeStructable } from '@cryptoeconomicslab/coder'
import JSBI from 'jsbi'
import UserAction, { createDepositUserAction } from './UserAction'
import EventEmitter from 'event-emitter'
import {
  StateUpdateRepository,
  CheckpointRepository,
  DepositedRangeRepository,
  UserActionRepository
} from './repository'
import { StateSyncer } from './usecase/StateSyncer'
import { ExitUsecase } from './usecase/ExitUsecase'
import { TransferUsecase } from './usecase/TransferUsecase'
import { PendingStateUpdatesVerifier } from './verifier/PendingStateUpdatesVerifier'
import APIClient from './APIClient'
import TokenManager from './managers/TokenManager'
import { executeChallenge } from './helper/challenge'
import { UserActionEvent, EmitterEvent } from './ClientEvent'
import { getOwner } from './helper/stateUpdateHelper'
import { Numberish } from './types'

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
  private stateSyncer: StateSyncer
  private exitUsecase: ExitUsecase
  private transferUsecase: TransferUsecase
  private pendingStateUpdatesVerifier: PendingStateUpdatesVerifier

  constructor(
    private wallet: Wallet,
    private witnessDb: KeyValueStore,
    private adjudicationContract: IAdjudicationContract,
    private depositContractFactory: (address: Address) => IDepositContract,
    private tokenContractFactory: (address: Address) => IERC20DetailedContract,
    private commitmentContract: ICommitmentContract,
    private ownershipPayoutContract: IOwnershipPayoutContract,
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
    const commitmentVerifierAddress = ovmContext.coder.decode(
      Address.default(),
      Bytes.fromHexString(
        this.deciderConfig.constantVariableTable.commitmentContract
      )
    )
    this.stateSyncer = new StateSyncer(
      this.ee,
      this.witnessDb,
      this.commitmentContract,
      Address.from(this.deciderConfig.commitment),
      commitmentVerifierAddress,
      this.apiClient,
      this.deciderManager,
      this.tokenManager
    )
    this.exitUsecase = new ExitUsecase(
      this.ee,
      this.witnessDb,
      this.adjudicationContract,
      this.commitmentContract,
      this.ownershipPayoutContract,
      this.deciderManager,
      this.tokenManager
    )
    this.transferUsecase = new TransferUsecase(
      this.witnessDb,
      this.wallet,
      this.apiClient,
      this.tokenManager
    )
    this.pendingStateUpdatesVerifier = new PendingStateUpdatesVerifier(
      this.ee,
      this.witnessDb,
      this.apiClient,
      this.tokenManager
    )
  }

  /**
   * Initialize Plasma Light Client by options
   * @param options LightClientOptions to instantiate LightClient
   */
  static async initilize(options: LightClientOptions): Promise<LightClient> {
    return new LightClient(
      options.wallet,
      options.witnessDb,
      options.adjudicationContract,
      options.depositContractFactory,
      options.tokenContractFactory,
      options.commitmentContract,
      options.ownershipPayoutContract,
      options.deciderConfig,
      options.aggregatorEndpoint
    )
  }

  public ownershipProperty(owner: Address): Property {
    return this.ownershipPredicate.makeProperty([
      ovmContext.coder.encode(owner)
    ])
  }

  public get address(): string {
    return this.wallet.getAddress().data
  }

  public get syncing(): boolean {
    return this._syncing
  }

  private async getClaimDb(): Promise<KeyValueStore> {
    return await this.witnessDb.bucket(Bytes.fromString('claimedProperty'))
  }

  /**
   * Get current balance of tokens in plasma.
   * All ERC20 tokens including Peth registered by `registerToken` method are included.
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
    const stateUpdateRepository = await StateUpdateRepository.init(
      this.witnessDb
    )

    const resultPromise = this.tokenManager.tokenContractAddresses.map(
      async addr => {
        const depositContractAddress = this.tokenManager.getDepositContractAddress(
          addr
        )
        if (!depositContractAddress)
          throw new Error('Deposit Contract Address not found')
        const data = await stateUpdateRepository.getVerifiedStateUpdates(
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
      async (blockNumber, root, mainchainBlockNumber, mainchainTimestamp) => {
        console.log('new block submitted event:', root.toHexString())
        await this.stateSyncer.sync(blockNumber, Address.from(this.address))
        await this.pendingStateUpdatesVerifier.verify(blockNumber)
      }
    )
    this.commitmentContract.startWatchingEvents()
    const blockNumber = await this.commitmentContract.getCurrentBlock()

    await this.stateSyncer.syncUntil(blockNumber, Address.from(this.address))
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
    const so = this.ownershipProperty(to)
    await this.transferUsecase.sendTransaction(amount, tokenContractAddress, so)
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
    await this.transferUsecase.sendTransaction(
      amount,
      tokenContractAddress,
      stateObject
    )
  }

  /**
   * register ERC20 token.
   * use default ERC20 contract wrapper
   * @param erc20ContractAddress ERC20 token address to register
   * @param depositContractAddress deposit contract address connecting to tokenAddress above
   */
  public async registerToken(
    erc20ContractAddress: string,
    depositContractAddress: string
  ) {
    const depositedRangeRepository = await DepositedRangeRepository.init(
      this.witnessDb
    )
    const depositContract = this.depositContractFactory(
      Address.from(depositContractAddress)
    )
    const erc20Contract = this.tokenContractFactory(
      Address.from(erc20ContractAddress)
    )
    await this.tokenManager.addContracts(erc20Contract, depositContract)
    depositContract.subscribeDepositedRangeExtended(async (range: Range) => {
      await depositedRangeRepository.extendRange(depositContract.address, range)
    })

    depositContract.subscribeDepositedRangeRemoved(async (range: Range) => {
      await depositedRangeRepository.removeRange(depositContract.address, range)
    })

    depositContract.subscribeCheckpointFinalized(
      async (checkpointId: Bytes, checkpoint: [Property]) => {
        const stateUpdateRepository = await StateUpdateRepository.init(
          this.witnessDb
        )
        const checkpointRepository = await CheckpointRepository.init(
          this.witnessDb
        )

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
        await checkpointRepository.insertCheckpoint(depositContract.address, c)

        const stateUpdate = StateUpdate.fromProperty(checkpoint[0])
        const owner = getOwner(stateUpdate)
        if (owner && owner.data === this.wallet.getAddress().data) {
          await stateUpdateRepository.insertVerifiedStateUpdate(
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
          const actionRepository = await UserActionRepository.init(
            this.witnessDb
          )
          await actionRepository.insertAction(blockNumber, range, action)

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

  // Exit Usecase

  public async startWithdrawal(
    amount: Numberish,
    tokenContractAddress: string
  ) {
    await this.exitUsecase.startWithdrawal(amount, tokenContractAddress)
  }

  public async completeWithdrawal(exit: IExit) {
    await this.exitUsecase.completeWithdrawal(exit, Address.from(this.address))
  }

  public async getPendingWithdrawals(): Promise<IExit[]> {
    return await this.exitUsecase.getPendingWithdrawals()
  }

  /**
   * FIXME: use DisputeContract.challenge method
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

  // FIXME: watch Dispute Contract
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
        const stateUpdateRepository = await StateUpdateRepository.init(
          this.witnessDb
        )

        const exit = this.exitUsecase.createExitFromProperty(property)
        if (exit) {
          console.log('Exit property claimed')
          const { range, depositContractAddress } = exit.stateUpdate

          // TODO: implement general way to check if client should challenge claimed property.
          const stateUpdates = await stateUpdateRepository.getVerifiedStateUpdates(
            depositContractAddress,
            range
          )
          if (stateUpdates.length > 0) {
            const decision = await this.deciderManager.decide(property)
            if (getOwner(exit.stateUpdate).data === this.address) {
              // exit initiated with this client. save exit into db
              await this.exitUsecase.saveExit(exit)
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

  /**
   * get all user actions until currentBlockNumber
   */
  public async getAllUserActions(): Promise<UserAction[]> {
    let result: UserAction[] = []
    const currentBlockNumber = await this.commitmentContract.getCurrentBlock()
    let blockNumber = JSBI.BigInt(0)
    const actionRepository = await UserActionRepository.init(this.witnessDb)
    while (JSBI.lessThanOrEqual(blockNumber, currentBlockNumber.data)) {
      const actions = await actionRepository.getUserActions(
        BigNumber.from(blockNumber)
      )
      result = result.concat(actions)
      blockNumber = JSBI.add(blockNumber, JSBI.BigInt(1))
    }
    return result
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

  public subscribeSyncStarted(handler: (blockNumber: BigNumber) => void) {
    this.ee.on(EmitterEvent.SYNC_STARTED, handler)
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
