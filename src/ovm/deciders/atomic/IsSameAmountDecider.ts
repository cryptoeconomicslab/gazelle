import Coder from '../../../coder'
import { Bytes } from '../../../types/Codables'
import { Decider } from '../../interfaces/Decider'
import { Decision } from '../../types'
import { DeciderManagerInterface } from '../../DeciderManager'
import { Range } from '../../../types'
import { DecoderUtil } from '../../../utils'

/**
 * IsSameAmountDecider decides to true if given two range is same amount (end - start)
 */
export class IsSameAmountDecider implements Decider {
  public async decide(
    manager: DeciderManagerInterface,
    inputs: Bytes[]
  ): Promise<Decision> {
    if (inputs.length !== 2) {
      return {
        outcome: false,
        challenges: []
      }
    }

    const first = DecoderUtil.decodeStructable(Range, Coder, inputs[0])
    const firstAmount = first.end.data - first.start.data
    const second = DecoderUtil.decodeStructable(Range, Coder, inputs[1])
    const secondAmount = second.end.data - second.start.data

    return {
      outcome: firstAmount === secondAmount,
      challenges: []
    }
  }
}
