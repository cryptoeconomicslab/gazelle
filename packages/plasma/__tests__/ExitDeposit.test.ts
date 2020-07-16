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

// TODO: fix later implement
describe.skip('ExitDeposit', () => {
  const testStateUpdate = new StateUpdate(
    Address.default(),
    Address.default(),
    new Range(BigNumber.from(0), BigNumber.from(5)),
    BigNumber.from(0),
    new Property(Address.default(), [Bytes.fromHexString('0x01')])
  )
  const testCheckpoint = new Checkpoint(testStateUpdate, BigNumber.from(1))

  const exitDepositProperty = new Property(Address.default(), [
    Coder.encode(testStateUpdate.property.toStruct()),
    Coder.encode(testCheckpoint.toStruct())
  ])

  test('encode, decode', () => {
    const exit = ExitDeposit.fromProperty(exitDepositProperty)
    const encoded = Coder.encode(exit.property.toStruct())
    const decoded = decodeStructable(Property, Coder, encoded)
    const decodedExit = ExitDeposit.fromProperty(decoded)
    expect(decodedExit).toEqual(exit)
  })
})
