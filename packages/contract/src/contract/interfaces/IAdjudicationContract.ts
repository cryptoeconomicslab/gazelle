import {
  Bytes,
  BigNumber,
  List,
  Property
} from '@cryptoeconomicslab/primitives'
import { ChallengeGame } from '@cryptoeconomicslab/ovm'

export interface IAdjudicationContract {
  /**
   * @name getGame
   * @description Gets instantiated challenge game by gameId.
   *     Throw exception if game is not found.
   * @param gameId
   */
  getGame(gameId: Bytes): Promise<ChallengeGame>

  /**
   * @name isDecided
   * @description Gets if a game is decided or not
   * @param gameId
   */
  isDecided(gameId: Bytes): Promise<boolean>

  /**
   * @name isDecidable
   * @description Gets if a game is ready to decide
   * @param gameId
   */
  isDecidable(gameId: Bytes): Promise<boolean>

  /**
   * @name claimProperty
   * @description Claims property to create new game.
   * @param property
   */
  claimProperty(property: Property): Promise<void>

  /**
   * @name decideClaimToTrue
   * @description decide claim to true
   * @param gameId
   */
  decideClaimToTrue(gameId: Bytes): Promise<void>

  /**
   * @name decideClaimToFalse
   * @description decide claim to false
   * @param property
   * @param challengingProperty
   */
  decideClaimToFalse(
    property: Property,
    challengingProperty: Property
  ): Promise<void>

  /**
   * @name removeChallenge
   * @description remove challenge of a game
   * @param property
   * @param challengingProperty
   */
  removeChallenge(
    property: Property,
    challengingProperty: Property
  ): Promise<void>

  /**
   * @name decideClaimWithWitness
   * @description decide the game decision with given witness
   * @param property
   * @param witnesses
   */
  decideClaimWithWitness(property: Property, witnesses: Bytes[]): Promise<void>

  /**
   * @name clallenge
   * @description challenge a game specified by gameId with a challengingGame specified by challengingGameId
   * @param property
   * @param challengeInputs
   * @param challengingProperty
   */
  challenge(
    property: Property,
    challengeInputs: List<Bytes>,
    challengingProperty: Property
  ): Promise<void>

  // subscribe methods
  subscribeAtomicPropositionDecided(
    handler: (gameId: Bytes, decision: boolean) => void
  ): void
  subscribeNewPropertyClaimed(
    handler: (
      gameId: Bytes,
      property: Property,
      createdBlock: BigNumber
    ) => void
  ): void
  subscribeClaimChallenged(
    handler: (gameId: Bytes, challengeGameId: Bytes) => void
  ): void
  subscribeClaimDecided(
    handler: (gameId: Bytes, decision: boolean) => void
  ): void
  subscribeChallengeRemoved(
    handler: (gameId: Bytes, challengeGameId: Bytes) => void
  ): void
  startWatchingEvents(): void
  unsubscribeAll(): void
}
