import {
  Address,
  Bytes,
  BigNumber,
  Property,
  Range
} from '@cryptoeconomicslab/primitives'
import { Block, StateUpdate } from '../src'
import Coder from '@cryptoeconomicslab/coder'
import { DateUtils } from '@cryptoeconomicslab/utils'
import { setupContext } from '@cryptoeconomicslab/context'
setupContext({ coder: Coder })

describe('Block', () => {
  const testAddr = Address.default()
  test('encode, decode', () => {
    const stateUpdateProperty = new Property(
      Address.default(),
      [
        Address.default(),
        new Range(BigNumber.from(0), BigNumber.from(10)).toStruct(),
        BigNumber.from(1),
        new Property(Address.default(), [
          Bytes.fromHexString('0x01')
        ]).toStruct()
      ].map(Coder.encode)
    )

    const map = new Map()
    map.set(testAddr.data, [
      StateUpdate.fromProperty(stateUpdateProperty),
      StateUpdate.fromProperty(stateUpdateProperty)
    ])
    map.set('0x0001100110011001100110011001101100110011', [
      StateUpdate.fromProperty(stateUpdateProperty)
    ])
    const timestamp = DateUtils.getCurrentDate()
    const block = new Block(BigNumber.from(5), map, timestamp)
    const encoded = Coder.encode(block.toStruct())
    const decoded = Block.fromStruct(
      Coder.decode(Block.getParamType(), encoded)
    )

    expect(decoded).toEqual(block)
  })

  test('getInclusionProof', async () => {
    const stateUpdateProperty = new Property(
      Address.default(),
      [
        Address.default(),
        new Range(BigNumber.from(0), BigNumber.from(10)).toStruct(),
        BigNumber.from(1),
        new Property(Address.default(), [
          Bytes.fromHexString('0x01')
        ]).toStruct()
      ].map(Coder.encode)
    )

    const map = new Map()
    map.set(testAddr.data, [StateUpdate.fromProperty(stateUpdateProperty)])
    const timestamp = DateUtils.getCurrentDate()
    const block = new Block(BigNumber.from(5), map, timestamp)
    const inclusionProof = block.getInclusionProof(
      StateUpdate.fromProperty(stateUpdateProperty)
    )

    expect(inclusionProof).not.toBeNull()
  })
})
