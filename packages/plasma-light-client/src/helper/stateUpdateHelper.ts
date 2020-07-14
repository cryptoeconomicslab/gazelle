import { Address } from '@cryptoeconomicslab/primitives'
import { StateUpdate } from '@cryptoeconomicslab/plasma'

export function getOwner(stateUpdate: StateUpdate): Address {
  return ovmContext.coder.decode(
    Address.default(),
    stateUpdate.stateObject.inputs[0]
  )
}
