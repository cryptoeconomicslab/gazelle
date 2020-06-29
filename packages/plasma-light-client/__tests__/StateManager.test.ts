import StateManager from '../src/managers/StateManager'
import { StateUpdate } from '@cryptoeconomicslab/plasma'

import { KeyValueStore } from '@cryptoeconomicslab/db'
import { IndexedDbKeyValueStore } from '@cryptoeconomicslab/indexeddb-kvs'

import {
  Range,
  Bytes,
  BigNumber,
  Address,
  Property
} from '@cryptoeconomicslab/primitives'
import { setupContext } from '@cryptoeconomicslab/context'
import JsonCoder from '@cryptoeconomicslab/coder'
import 'fake-indexeddb/auto'
import JSBI from 'jsbi'
setupContext({
  coder: JsonCoder
})

function su(start: JSBI, end: JSBI): StateUpdate {
  const property = new Property(
    Address.default(),
    [
      Address.default(),
      new Range(BigNumber.from(start), BigNumber.from(end)).toStruct(),
      BigNumber.from(1),
      new Property(Address.default(), [Bytes.fromHexString('0x01')]).toStruct()
    ].map(ovmContext.coder.encode)
  )
  return StateUpdate.fromProperty(property)
}

describe('StateManager', () => {
  let stateManager: StateManager, db: KeyValueStore

  beforeEach(async () => {
    db = new IndexedDbKeyValueStore(Bytes.fromString('state'))
    stateManager = new StateManager(db)
  })

  test('resolve state update with single state update', async () => {
    await stateManager.insertVerifiedStateUpdate(
      Address.default(),
      su(JSBI.BigInt(0), JSBI.BigInt(10))
    )
    await stateManager.insertVerifiedStateUpdate(
      Address.default(),
      su(JSBI.BigInt(10), JSBI.BigInt(20))
    )

    const s = await stateManager.resolveStateUpdate(
      Address.default(),
      JSBI.BigInt(5)
    )
    expect(s).toEqual([su(JSBI.BigInt(0), JSBI.BigInt(5))])
  })

  test('resolve state update with multiple state updates', async () => {
    await stateManager.insertVerifiedStateUpdate(
      Address.default(),
      su(JSBI.BigInt(0), JSBI.BigInt(10))
    )
    await stateManager.insertVerifiedStateUpdate(
      Address.default(),
      su(JSBI.BigInt(10), JSBI.BigInt(20))
    )

    const resolvedStateUpdates = await stateManager.resolveStateUpdate(
      Address.default(),
      JSBI.BigInt(15)
    )

    if (!resolvedStateUpdates) throw new Error('resolvedStateUpdates is null')
    expect(resolvedStateUpdates).toEqual([
      su(JSBI.BigInt(0), JSBI.BigInt(10)),
      su(JSBI.BigInt(10), JSBI.BigInt(15))
    ])
  })

  test('resolve state update to be null', async () => {
    await stateManager.insertVerifiedStateUpdate(
      Address.default(),
      su(JSBI.BigInt(0), JSBI.BigInt(10))
    )
    await stateManager.insertVerifiedStateUpdate(
      Address.default(),
      su(JSBI.BigInt(10), JSBI.BigInt(20))
    )

    const resolvedStateUpdates = await stateManager.resolveStateUpdate(
      Address.default(),
      JSBI.BigInt(25)
    )
    expect(resolvedStateUpdates).toBeNull()
  })
})
