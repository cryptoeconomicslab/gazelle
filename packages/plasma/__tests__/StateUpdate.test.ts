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
  const stateUpdateProperty = new Property(
    Address.default(),
    [
      Address.default(),
      new Range(BigNumber.from(0), BigNumber.from(10)).toStruct(),
      BigNumber.from(1),
      new Property(Address.default(), [Bytes.fromHexString('0x01')]).toStruct()
    ].map(Coder.encode)
  )

  test('new(property)', () => {
    const stateUpdate = StateUpdate.fromProperty(stateUpdateProperty)
    expect(stateUpdate.property).toEqual(stateUpdateProperty)
    expect(stateUpdate.depositContractAddress).toEqual(Address.default())
    expect(stateUpdate.range).toEqual(
      new Range(BigNumber.from(0), BigNumber.from(10))
    )
    expect(stateUpdate.blockNumber).toEqual(BigNumber.from(1))
    expect(stateUpdate.stateObject).toEqual(
      new Property(Address.default(), [Bytes.fromHexString('0x01')])
    )
  })

  test('toRecord()', () => {
    const stateUpdate = StateUpdate.fromProperty(stateUpdateProperty)
    const record = stateUpdate.toRecord()
    expect(record).toEqual(
      new StateUpdateRecord(
        Address.default(),
        Address.default(),
        BigNumber.from(1),
        new Property(Address.default(), [Bytes.fromHexString('0x01')])
      )
    )
  })

  test('fromRangeRecord()', () => {
    const record = new StateUpdateRecord(
      Address.default(),
      Address.default(),
      BigNumber.from(1),
      new Property(Address.default(), [Bytes.fromHexString('0x01')])
    )
    const range = new Range(BigNumber.from(0), BigNumber.from(10))

    expect(StateUpdate.fromRecord(record, range)).toStrictEqual(
      StateUpdate.fromProperty(stateUpdateProperty)
    )
  })

  test('range', () => {
    const stateUpdate = StateUpdate.fromProperty(stateUpdateProperty)
    expect(stateUpdate.range).toEqual(
      new Range(BigNumber.from(0), BigNumber.from(10))
    )
  })

  test('update()', () => {
    const stateUpdate = StateUpdate.fromProperty(stateUpdateProperty)
    stateUpdate.update({
      range: new Range(BigNumber.from(5), BigNumber.from(10))
    })
    expect(stateUpdate.range).toEqual(
      new Range(BigNumber.from(5), BigNumber.from(10))
    )
  })
})
