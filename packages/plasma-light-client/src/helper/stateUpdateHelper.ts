import {
  Address,
  BigNumber,
  FixedBytes,
  Struct
} from '@cryptoeconomicslab/primitives'
import { StateUpdate } from '@cryptoeconomicslab/plasma'
import * as StateObjectHelper from './stateObjectHelper'
import { Keccak256 } from '@cryptoeconomicslab/hash'

export function getOwner(stateUpdate: StateUpdate): Address {
  return StateObjectHelper.getOwner(stateUpdate.stateObject)
}

export function getChunkId(
  depositContractAddress: Address,
  blockNumber: BigNumber,
  start: BigNumber
): FixedBytes {
  const { coder } = ovmContext
  return FixedBytes.from(
    32,
    Keccak256.hash(
      coder.encode(
        new Struct([
          {
            key: 'depositContractAddress',
            value: depositContractAddress
          },
          {
            key: 'blockNumber',
            value: blockNumber
          },

          {
            key: 'start',
            value: start
          }
        ])
      )
    ).data
  )
}
