import * as ethers from 'ethers'
import {
  Bytes,
  Address,
  BigNumber,
  FixedBytes,
  List,
  Property
} from '@cryptoeconomicslab/primitives'
import { ChallengeGame } from '@cryptoeconomicslab/ovm'
import { EventLog, IAdjudicationContract } from '@cryptoeconomicslab/contract'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import EthEventWatcher, { EventWatcherOptions } from '../events'

export class AdjudicationContract implements IAdjudicationContract {
  private connection: ethers.Contract
  private eventWatcher: EthEventWatcher
  readonly gasLimit: number
  public static abi = [
    'event AtomicPropositionDecided(bytes32 gameId, bool decision)',
    'event NewPropertyClaimed(bytes32 gameId, tuple(address, bytes[]) property, uint256 createdBlock)',
    'event ClaimChallenged(bytes32 gameId, bytes32 challengeGameId)',
    'event ClaimDecided(bytes32 gameId, bool decision)',
    'event ChallengeRemoved(bytes32 gameId, bytes32 challengeGameId)',
    'function getGame(bytes32 gameId) view returns(tuple(bytes32, bytes[], bool, uint256))',
    'function isDecided(bytes32 gameId) view returns(bool)',
    'function isDecidedById(bytes32 gameId) view returns(bool)',
    'function isDecidable(bytes32 gameId) view returns(bool)',
    'function claimProperty(tuple(address, bytes[]))',
    'function decideClaimToTrue(bytes32 gameId)',
    'function decideClaimToFalse(tuple(address, bytes[]) property, tuple(address, bytes[]) challengingProperty)',
    'function decideClaimWithWitness(tuple(address, bytes[]) property, bytes[] witnesses)',
    'function removeChallenge(tuple(address, bytes[]) property, tuple(address, bytes[]) challengingProperty)',
    'function setPredicateDecision(bytes32 gameId, bool decision)',
    'function challenge(tuple(address, bytes[]) property, bytes[] challengeInputs, tuple(address, bytes[]) challengingProperty)'
  ]
  constructor(
    address: Address,
    eventDb: KeyValueStore,
    signer: ethers.Signer,
    provider?: ethers.providers.Provider,
    eventWatcherOptions?: EventWatcherOptions
  ) {
    this.connection = new ethers.Contract(
      address.data,
      AdjudicationContract.abi,
      signer
    )
    this.eventWatcher = new EthEventWatcher({
      provider: provider || this.connection.provider,
      kvs: eventDb,
      contractAddress: address.data,
      contractInterface: this.connection.interface,
      options: eventWatcherOptions
    })
    this.gasLimit = 1500000
  }

  private encodeProperty(property: Property) {
    return [
      property.deciderAddress.data,
      property.inputs.map(i => i.toHexString())
    ]
  }

  async getGame(gameId: Bytes): Promise<ChallengeGame> {
    const challengeGame = await this.connection.getGame(gameId.toHexString())
    return new ChallengeGame(
      FixedBytes.fromHexString(32, challengeGame[0]),
      challengeGame[1].map((challenge: string) =>
        Bytes.fromHexString(challenge)
      ),
      challengeGame[2],
      BigNumber.from(challengeGame[3].toString())
    )
  }

  async isDecided(gameId: Bytes): Promise<boolean> {
    return await this.connection.isDecidedById(gameId.toHexString())
  }

  async isDecidable(gameId: Bytes): Promise<boolean> {
    return await this.connection.isDecidable(gameId.toHexString())
  }

  async claimProperty(property: Property): Promise<void> {
    return await this.connection.claimProperty(this.encodeProperty(property), {
      gasLimit: this.gasLimit
    })
  }

  async decideClaimToTrue(gameId: Bytes): Promise<void> {
    const tx = await this.connection.decideClaimToTrue(gameId.toHexString(), {
      gasLimit: this.gasLimit
    })
    await tx.wait()
  }

  async decideClaimToFalse(
    property: Property,
    challengingProperty: Property
  ): Promise<void> {
    return await this.connection.decideClaimToFalse(
      this.encodeProperty(property),
      this.encodeProperty(challengingProperty),
      {
        gasLimit: this.gasLimit
      }
    )
  }

  async removeChallenge(
    property: Property,
    challengingProperty: Property
  ): Promise<void> {
    return await this.connection.removeChallenge(
      this.encodeProperty(property),
      this.encodeProperty(challengingProperty),
      {
        gasLimit: this.gasLimit
      }
    )
  }

  async decideClaimWithWitness(
    property: Property,
    witnesses: Bytes[]
  ): Promise<void> {
    return await this.connection.decideClaimWithWitness(
      this.encodeProperty(property),
      witnesses.map(w => w.toHexString()),
      {
        gasLimit: this.gasLimit
      }
    )
  }

  async challenge(
    property: Property,
    challengeInputs: List<Bytes>,
    challengingProperty: Property
  ): Promise<void> {
    return await this.connection.challenge(
      this.encodeProperty(property),
      challengeInputs.data.map(challengeInput => challengeInput.toHexString()),
      this.encodeProperty(challengingProperty),
      {
        gasLimit: this.gasLimit
      }
    )
  }

  subscribeAtomicPropositionDecided(
    handler: (gameId: Bytes, decision: boolean) => void
  ): void {
    this.eventWatcher.subscribe('AtomicPropositionDecided', (log: EventLog) => {
      const gameId = log.values[0]
      const decision = log.values[1]
      handler(Bytes.fromHexString(gameId), decision)
    })
  }

  subscribeNewPropertyClaimed(
    handler: (
      gameId: Bytes,
      property: Property,
      createdBlock: BigNumber
    ) => void
  ): void {
    this.eventWatcher.subscribe('NewPropertyClaimed', (log: EventLog) => {
      const gameId = log.values[0]
      const property = log.values[1]
      const createdBlock = log.values[2]
      handler(
        Bytes.fromHexString(gameId),
        this.getProperty(property),
        BigNumber.fromString(createdBlock.toString())
      )
    })
  }

  subscribeClaimChallenged(
    handler: (gameId: Bytes, challengeGameId: Bytes) => void
  ): void {
    this.eventWatcher.subscribe('ClaimChallenged', (log: EventLog) => {
      const gameId = log.values[0]
      const challengeGameId = log.values[1]
      handler(Bytes.fromHexString(gameId), Bytes.fromHexString(challengeGameId))
    })
  }

  subscribeClaimDecided(
    handler: (gameId: Bytes, decision: boolean) => void
  ): void {
    this.eventWatcher.subscribe('ClaimDecided', (log: EventLog) => {
      const gameId = log.values[0]
      const decision = log.values[1]
      handler(Bytes.fromHexString(gameId), decision)
    })
  }

  subscribeChallengeRemoved(
    handler: (gameId: Bytes, challengeGameId: Bytes) => void
  ): void {
    this.eventWatcher.subscribe('ChallengeRemoved', (log: EventLog) => {
      const gameId = log.values[0]
      const challengeGameId = log.values[1]
      handler(Bytes.fromHexString(gameId), Bytes.fromHexString(challengeGameId))
    })
  }

  private getProperty(property: any): Property {
    return new Property(
      Address.from(property[0]),
      property[1].map((i: string) => Bytes.fromHexString(i))
    )
  }

  async startWatchingEvents() {
    this.unsubscribeAll()
    await this.eventWatcher.start(() => {
      /* do nothing */
    })
  }

  unsubscribeAll() {
    this.eventWatcher.cancel()
  }
}
