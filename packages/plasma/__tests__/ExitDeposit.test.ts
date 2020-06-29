import {
  Address,
  Bytes,
  BigNumber,
  Property,
  Range
} from '@cryptoeconomicslab/primitives'
import { ExitDeposit, StateUpdate } from '../src'
import Coder, { decodeStructable } from '@cryptoeconomicslab/coder'
import { setupContext } from '@cryptoeconomicslab/context'
import { Checkpoint } from '../lib'
setupContext({ coder: Coder })

describe('ExitDeposit', () => {
  const testStateUpdate = new StateUpdate(
    Address.default(),
    Address.default(),
    new Range(BigNumber.from(0), BigNumber.from(5)),
    BigNumber.from(0),
    new Property(Address.default(), [Bytes.fromHexString('0x01')])
  )
  const testCheckpoint = new Checkpoint(
    Address.default(),
    testStateUpdate.property
  )

  const exitDepositProperty = new Property(Address.default(), [
    ovmContext.coder.encode(testStateUpdate.property.toStruct()),
    ovmContext.coder.encode(testCheckpoint.property.toStruct())
  ])

  test('encode, decode', () => {
    const exit = ExitDeposit.fromProperty(exitDepositProperty)
    const encoded = ovmContext.coder.encode(exit.property.toStruct())
    const decoded = decodeStructable(Property, ovmContext.coder, encoded)
    const decodedExit = ExitDeposit.fromProperty(decoded)
    expect(decodedExit).toEqual(exit)
  })
})
