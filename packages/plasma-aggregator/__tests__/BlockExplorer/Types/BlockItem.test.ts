import { transformBlockItemFrom } from '../../../src/BlockExplorer/Types/BlockItem'
import { Block, StateUpdate } from '@cryptoeconomicslab/plasma'
import {
  Address,
  Bytes,
  BigNumber,
  Integer,
  Property,
  Range
} from '@cryptoeconomicslab/primitives'
import Coder from '@cryptoeconomicslab/coder'
import { setupContext } from '@cryptoeconomicslab/context'
import { DateUtils } from '@cryptoeconomicslab/utils'
setupContext({ coder: Coder })

const su = new StateUpdate(
  Address.default(),
  new Range(BigNumber.from(0), BigNumber.from(10)),
  BigNumber.from(1),
  new Property(Address.default(), [Bytes.fromHexString('0x01')]),
  Bytes.default()
)

describe('BlockItem', () => {
  const testAddr = '0x0000000000000000000000000000000000000001'
  const testAddr2 = '0x0000000000000000000000000000000000000002'

  const map = new Map()
  map.set(testAddr, [su, su])
  map.set(testAddr2, [su, su, su])
  const timestamp = DateUtils.getCurrentDate()
  const block = new Block(
    BigNumber.from(5),
    map,
    BigNumber.from(10),
    Integer.from(timestamp)
  )

  test('transformBlockItemFrom', () => {
    expect(transformBlockItemFrom(block)).toEqual({
      blockNumber: '5',
      transactions: 5,
      mainchainBlockNumber: '10',
      timestamp
    })
  })
})
