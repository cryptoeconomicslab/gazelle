import { transformBlockItemFrom } from '../../../src/BlockExplorer/Types/BlockItem'
import { Block, StateUpdate } from '@cryptoeconomicslab/plasma'
import {
  Address,
  Bytes,
  BigNumber,
  Range
} from '@cryptoeconomicslab/primitives'
import { Property } from '@cryptoeconomicslab/ovm'
import Coder from '@cryptoeconomicslab/coder'
import { setupContext } from '@cryptoeconomicslab/context'
import { DateUtils } from '@cryptoeconomicslab/utils'
setupContext({ coder: Coder })

const stateUpdateProperty = new Property(
  Address.default(),
  [
    Address.default(),
    new Range(BigNumber.from(0), BigNumber.from(10)).toStruct(),
    BigNumber.from(1),
    new Property(Address.default(), [Bytes.fromHexString('0x01')]).toStruct()
  ].map(Coder.encode)
)

describe('BlockItem', () => {
  const testAddr = '0x0000000000000000000000000000000000000001'
  const testAddr2 = '0x0000000000000000000000000000000000000002'

  const map = new Map()
  const su = StateUpdate.fromProperty(stateUpdateProperty)
  map.set(testAddr, [su, su])
  map.set(testAddr2, [su, su, su])
  const timestamp = DateUtils.getCurrentDate()
  const block = new Block(BigNumber.from(5), map, timestamp)

  test('transformBlockItemFrom', () => {
    expect(transformBlockItemFrom(block)).toEqual({
      blockNumber: '5',
      transactions: 5,
      timestamp
    })
  })
})
