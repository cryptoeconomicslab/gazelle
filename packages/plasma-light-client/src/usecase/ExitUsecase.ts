import JSBI from 'jsbi'
import EventEmitter from 'event-emitter'
import { Address, Bytes, Property } from '@cryptoeconomicslab/primitives'
import {
  IExit,
  Exit,
  ExitDeposit,
  StateUpdate
} from '@cryptoeconomicslab/plasma'
import { getWitnesses, KeyValueStore } from '@cryptoeconomicslab/db'
import { hint as Hint, DeciderManager } from '@cryptoeconomicslab/ovm'
import { Numberish } from '../types'
import TokenManager from '../managers/TokenManager'
import {
  StateUpdateRepository,
  CheckpointRepository,
  ExitRepositoryOld,
  DepositedRangeRepository,
  UserActionRepository
} from '../repository'
import { EmitterEvent, UserActionEvent } from '../ClientEvent'
import { createExitUserAction } from '../UserAction'
import {
  IAdjudicationContract,
  ICommitmentContract,
  IOwnershipPayoutContract
} from '@cryptoeconomicslab/contract'
import { Keccak256 } from '@cryptoeconomicslab/hash'

export class ExitUsecase {
  constructor(
    private ee: EventEmitter,
    private witnessDb: KeyValueStore,
    private adjudicationContract: IAdjudicationContract,
    private commitmentContract: ICommitmentContract,
    private ownershipPayoutContract: IOwnershipPayoutContract,
    private deciderManager: DeciderManager,
    private tokenManager: TokenManager
  ) {}

  private async getClaimDb(): Promise<KeyValueStore> {
    return await this.witnessDb.bucket(Bytes.fromString('claimedProperty'))
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
    const stateUpdateRepository = await StateUpdateRepository.init(
      this.witnessDb
    )

    const stateUpdates = await stateUpdateRepository.resolveStateUpdate(
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
   * @param address Address to exit on chain
   */
  public async completeWithdrawal(exit: IExit, address: Address) {
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
    const depositedRangeRepository = await DepositedRangeRepository.init(
      this.witnessDb
    )

    const depositedRangeId = await depositedRangeRepository.getDepositedRangeId(
      exit.stateUpdate.depositContractAddress,
      exit.range
    )

    await this.ownershipPayoutContract.finalizeExit(
      exit.stateUpdate.depositContractAddress,
      exitProperty,
      depositedRangeId,
      address
    )

    this.ee.emit(EmitterEvent.EXIT_FINALIZED, exit.id)
  }

  /**
   * Get pending withdrawal list
   */
  public async getPendingWithdrawals(): Promise<IExit[]> {
    const exitRepository = await ExitRepositoryOld.init(
      this.witnessDb,
      this.deciderManager.getDeciderAddress('Exit'),
      this.deciderManager.getDeciderAddress('ExitDeposit')
    )

    const exitList = await Promise.all(
      this.tokenManager.depositContractAddresses.map(async addr => {
        return await exitRepository.getAllExits(addr)
      })
    )
    return Array.prototype.concat.apply([], exitList)
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

    const checkpointRepository = await CheckpointRepository.init(this.witnessDb)
    const { coder } = ovmContext
    const inputsOfExitProperty = [coder.encode(stateUpdate.property.toStruct())]
    const checkpoints = await checkpointRepository.getSettledCheckpoints(
      stateUpdate.depositContractAddress,
      stateUpdate.range
    )
    if (checkpoints.length > 0) {
      const checkpointStateUpdate = checkpoints[0]
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
  public createExitFromProperty(property: Property): IExit | null {
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

  public async saveExit(exit: IExit) {
    const { coder } = ovmContext
    const stateUpdate = exit.stateUpdate
    const propertyBytes = coder.encode(exit.property.toStruct())
    const exitRepository = await ExitRepositoryOld.init(
      this.witnessDb,
      this.deciderManager.getDeciderAddress('Exit'),
      this.deciderManager.getDeciderAddress('ExitDeposit')
    )
    await exitRepository.insertExit(stateUpdate.depositContractAddress, exit)

    const stateUpdateRepository = await StateUpdateRepository.init(
      this.witnessDb
    )

    await stateUpdateRepository.removeVerifiedStateUpdate(
      stateUpdate.depositContractAddress,
      stateUpdate.range
    )
    await stateUpdateRepository.insertExitStateUpdate(
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
    const actionRepository = await UserActionRepository.init(this.witnessDb)
    await actionRepository.insertAction(blockNumber, range, action)

    this.ee.emit(UserActionEvent.EXIT, action)
  }
}
