import { Address, Property } from '@cryptoeconomicslab/primitives'

export function getOwner(stateObject: Property): Address {
  return ovmContext.coder.decode(Address.default(), stateObject.inputs[0])
}
