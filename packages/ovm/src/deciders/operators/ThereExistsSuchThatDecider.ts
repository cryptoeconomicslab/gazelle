import { Bytes, Property } from '@cryptoeconomicslab/primitives'
import { getWitnesses, isHint, replaceHint } from '@cryptoeconomicslab/db'
import { Decider } from '../../interfaces/Decider'
import { DeciderManager } from '../../DeciderManager'
import { LogicalConnective } from '../../types'
import { TraceInfoCreator } from '../../Tracer'

/**
 * ThereExists decides property to true if any quantified value fulfill proposition.
 * inputs: Array<Bytes> [HintString, variableName, Property]
 * If decision outcome is true, ThereExistsSuchThatDecider returns its variable as witness.
 * This witness is appended to the head of witnesses generated by the child property.
 * If decision outcome is false, it should return valid challenge as challenges.
 * The valid challenge of ThereExistsSuchThat(P) is ForAllSuchThat(Not(P)).
 */
export class ThereExistsSuchThatDecider implements Decider {
  public async decide(
    manager: DeciderManager,
    inputs: Bytes[],
    substitutions: { [key: string]: Bytes } = {}
  ) {
    const { coder } = ovmContext
    let witnesses: Bytes[]
    if (isHint(inputs[0])) {
      witnesses = await getWitnesses(
        manager.witnessDb,
        replaceHint(inputs[0].intoString(), substitutions)
      )
    } else {
      throw new Error('inputs[0] must be valid hint data.')
    }
    const innerProperty = Property.fromStruct(
      coder.decode(Property.getParamType(), inputs[2])
    )
    const variableName = inputs[1].intoString()

    const decisions = await Promise.all(
      witnesses.map(async variable => {
        return await manager.decide(innerProperty, {
          ...substitutions,
          [variableName]: variable
        })
      })
    )
    const indexOfTrueDecision = decisions.findIndex(d => d.outcome)
    const childTraceInfo = decisions.find(d => d.outcome === false)?.traceInfo
    const challenge = {
      challengeInputs: [],
      property: new Property(
        manager.getDeciderAddress(LogicalConnective.ForAllSuchThat),
        [
          Bytes.default(),
          inputs[1],
          coder.encode(
            new Property(manager.getDeciderAddress(LogicalConnective.Not), [
              inputs[2]
            ]).toStruct()
          )
        ]
      )
    }

    if (indexOfTrueDecision >= 0) {
      // If any decision prove true
      let nextWitnesses: Bytes[] | undefined = undefined
      const witness = witnesses[indexOfTrueDecision]
      const childWitnesses = decisions[indexOfTrueDecision].witnesses || []
      nextWitnesses = [witness].concat(childWitnesses)
      return {
        outcome: true,
        witnesses: nextWitnesses,
        challenge: null
      }
    } else {
      // If there are no true decisions
      return {
        outcome: false,
        witnesses: [],
        challenge,
        traceInfo: childTraceInfo
          ? TraceInfoCreator.createThere(childTraceInfo)
          : undefined
      }
    }
  }
}
