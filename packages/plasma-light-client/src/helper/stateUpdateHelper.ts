import { Address } from '@cryptoeconomicslab/primitives'
import { StateUpdate } from '@cryptoeconomicslab/plasma'
import * as StateObjectHelper from './stateObjectHelper'

export function getOwner(stateUpdate: StateUpdate): Address {
  return StateObjectHelper.getOwner(stateUpdate.stateObject)
}
