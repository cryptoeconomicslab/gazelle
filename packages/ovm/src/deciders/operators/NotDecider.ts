import { Bytes, Property } from '@cryptoeconomicslab/primitives'
import { Decider } from '../../interfaces/Decider'
import { Decision } from '../../types'
import { DeciderManagerInterface } from '../../DeciderManager'
import { TraceInfoCreator } from '../../Tracer'

/**
 * NotDecider recieves one input and returns logical negation of its decision.
 * If decision outcome is false, valid challenge is inner property.
 * NotDecider never return witnesses.
 */
export class NotDecider implements Decider {
  public async decide(
    manager: DeciderManagerInterface,
    inputs: Bytes[],
    substitutions: { [key: string]: Bytes } = {}
  ): Promise<Decision> {
    const property = Property.fromStruct(
      ovmContext.coder.decode(Property.getParamType(), inputs[0])
    )
    const decision = await manager.decide(property)
    return {
      outcome: !decision.outcome,
      witnesses: [],
      challenge: {
        property: property,
        challengeInputs: []
      },
      traceInfo:
        decision.outcome && decision.traceInfo
          ? TraceInfoCreator.createNot(decision.traceInfo)
          : undefined
    }
  }
}
