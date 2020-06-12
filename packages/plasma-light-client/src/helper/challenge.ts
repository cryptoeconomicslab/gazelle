import { Bytes, List } from '@cryptoeconomicslab/primitives'
import { Challenge, DeciderManager, Property } from '@cryptoeconomicslab/ovm'
import { IAdjudicationContract } from '@cryptoeconomicslab/contract'

/**
 * @name executeChallenge
 * @description execute challenge procedure to game with challenge property
 * @param adjudicationContract
 * @param deciderManager
 * @param gameId Id of the game to challenge
 * @param challenge challenge data structure
 */
export async function executeChallenge(
  adjudicationContract: IAdjudicationContract,
  deciderManager: DeciderManager,
  property: Property,
  challenge: Challenge
) {
  try {
    await adjudicationContract.claimProperty(challenge.property)
  } catch (e) {
    console.error(e)
  }
  await adjudicationContract.challenge(
    property,
    List.from(
      Bytes,
      challenge.challengeInputs.map(challengeInput => challengeInput)
    ),
    challenge.property
  )
  const decisionOfCounterClaim = await deciderManager.decide(challenge.property)
  if (decisionOfCounterClaim.outcome && decisionOfCounterClaim.witnesses) {
    // decide claim if it's needed.
    await adjudicationContract.decideClaimWithWitness(
      challenge.property,
      decisionOfCounterClaim.witnesses
    )
    await adjudicationContract.decideClaimToFalse(property, challenge.property)
  } else {
    // TODO: how do we notify user of malicious case happening
    console.warn(`We did challenge, but the challenge hasn't decided yet.`)
  }
}
