import {
  Address,
  Bytes,
  BigNumber,
  Property,
  Range
} from '@cryptoeconomicslab/primitives'
import { Exit, StateUpdate } from '../src'
import Coder, { decodeStructable } from '@cryptoeconomicslab/coder'
import { setupContext } from '@cryptoeconomicslab/context'
import {
  DoubleLayerInclusionProof,
  IntervalTreeInclusionProof,
  AddressTreeInclusionProof
} from '@cryptoeconomicslab/merkle-tree'
setupContext({ coder: Coder })

describe('Exit', () => {
  const testInclusionProof = new DoubleLayerInclusionProof(
    new IntervalTreeInclusionProof(BigNumber.from(0), 0, []),
    new AddressTreeInclusionProof(Address.default(), 0, [])
  )
  const testStateUpdate = new StateUpdate(
    Address.default(),
    Address.default(),
    new Range(BigNumber.from(0), BigNumber.from(5)),
    BigNumber.from(0),
    new Property(Address.default(), [Bytes.fromHexString('0x01')])
  )
  const exitProperty = new Property(Address.default(), [
    ovmContext.coder.encode(testStateUpdate.property.toStruct()),
    ovmContext.coder.encode(testInclusionProof.toStruct())
  ])

  test('encode, decode', () => {
    const exit = Exit.fromProperty(exitProperty)
    const encoded = ovmContext.coder.encode(exit.property.toStruct())
    const decoded = decodeStructable(Property, ovmContext.coder, encoded)
    const decodedExit = Exit.fromProperty(decoded)
    expect(decodedExit).toEqual(exit)
  })
})
