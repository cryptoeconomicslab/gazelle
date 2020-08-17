import {
  Address,
  Bytes,
  BigNumber,
  Property,
  Range
} from '@cryptoeconomicslab/primitives'
import { StateUpdate, StateUpdateRecord } from '../src'
import Coder from '@cryptoeconomicslab/coder'
import { setupContext } from '@cryptoeconomicslab/context'
setupContext({ coder: Coder })

describe('StateUpdate', () => {
  const stateUpdate = new StateUpdate(
    Address.default(),
    new Range(BigNumber.from(0), BigNumber.from(10)),
    BigNumber.from(1),
    new Property(Address.default(), [Bytes.fromHexString('0x01')]),
    Bytes.default()
  )

  test('toRecord()', () => {
    const record = stateUpdate.toRecord()
    expect(record).toEqual(
      new StateUpdateRecord(
        Address.default(),
        BigNumber.from(1),
        new Property(Address.default(), [Bytes.fromHexString('0x01')]),
        Bytes.default()
      )
    )
  })

  test('fromRangeRecord()', () => {
    const record = new StateUpdateRecord(
      Address.default(),
      BigNumber.from(1),
      new Property(Address.default(), [Bytes.fromHexString('0x01')]),
      Bytes.default()
    )
    const range = new Range(BigNumber.from(0), BigNumber.from(10))

    expect(StateUpdate.fromRecord(record, range)).toStrictEqual(stateUpdate)
  })

  test('range', () => {
    expect(stateUpdate.range).toEqual(
      new Range(BigNumber.from(0), BigNumber.from(10))
    )
  })

  test('update()', () => {
    const stateUpdate = new StateUpdate(
      Address.default(),
      new Range(BigNumber.from(0), BigNumber.from(10)),
      BigNumber.from(1),
      new Property(Address.default(), [Bytes.fromHexString('0x01')]),
      Bytes.default()
    )
    stateUpdate.update({
      range: new Range(BigNumber.from(5), BigNumber.from(10))
    })
    expect(stateUpdate.range).toEqual(
      new Range(BigNumber.from(5), BigNumber.from(10))
    )
  })
})
