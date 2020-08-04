import {
  Address,
  Bytes,
  BigNumber,
  Integer,
  Property,
  Range
} from '@cryptoeconomicslab/primitives'
import { Block, StateUpdate } from '../src'
import Coder from '@cryptoeconomicslab/eth-coder'
import { DateUtils } from '@cryptoeconomicslab/utils'
import { setupContext } from '@cryptoeconomicslab/context'
setupContext({ coder: Coder })

describe('Block', () => {
  const testAddr = Address.default()
  test('encode, decode', () => {
    const stateUpdate = new StateUpdate(
      Address.default(),
      new Range(BigNumber.from(0), BigNumber.from(10)),
      BigNumber.from(1),
      new Property(Address.default(), [Bytes.fromHexString('0x01')])
    )

    const map = new Map()
    map.set(testAddr.data, [stateUpdate, stateUpdate])
    map.set('0x0001100110011001100110011001101100110011', [stateUpdate])
    const timestamp = DateUtils.getCurrentDate()
    const block = new Block(
      BigNumber.from(5),
      map,
      BigNumber.from(10),
      Integer.from(timestamp)
    )
    const encoded = Coder.encode(block.toStruct())
    const decoded = Block.fromStruct(
      Coder.decode(Block.getParamType(), encoded)
    )

    expect(decoded).toEqual(block)
  })

  test('getInclusionProof', async () => {
    const stateUpdate = new StateUpdate(
      Address.default(),
      new Range(BigNumber.from(0), BigNumber.from(10)),
      BigNumber.from(1),
      new Property(Address.default(), [Bytes.fromHexString('0x01')])
    )

    const map = new Map()
    map.set(testAddr.data, [stateUpdate])
    const timestamp = DateUtils.getCurrentDate()
    const block = new Block(
      BigNumber.from(5),
      map,
      BigNumber.from(10),
      Integer.from(timestamp)
    )
    const inclusionProof = block.getInclusionProof(stateUpdate)

    expect(inclusionProof).not.toBeNull()
  })
})
