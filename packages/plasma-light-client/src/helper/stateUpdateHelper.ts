import { Address, BigNumber, Bytes } from '@cryptoeconomicslab/primitives'
import { StateUpdate } from '@cryptoeconomicslab/plasma'
import * as StateObjectHelper from './stateObjectHelper'
import { Keccak256 } from '@cryptoeconomicslab/hash'

export function getOwner(stateUpdate: StateUpdate): Address {
  return StateObjectHelper.getOwner(stateUpdate.stateObject)
}

export function getPaymentId(blockNumber: BigNumber, start: BigNumber): Bytes {
  const { coder } = ovmContext
  return Keccak256.hash(
    Bytes.concat(coder.encode(blockNumber), coder.encode(start))
  )
}
