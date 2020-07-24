import { StateUpdateRepository } from '../../src/repository'
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
  return new StateUpdate(
    Address.default(),
    new Range(BigNumber.from(start), BigNumber.from(end)),
    BigNumber.from(1),
    new Property(Address.default(), [Bytes.fromHexString('0x01')])
  )
}

describe('StateUpdateRepository', () => {
  let repository: StateUpdateRepository, db: KeyValueStore

  beforeEach(async () => {
    db = new IndexedDbKeyValueStore(Bytes.fromString('state'))
    repository = await StateUpdateRepository.init(db)
  })

  test('resolve state update with single state update', async () => {
    await repository.insertVerifiedStateUpdate(
      Address.default(),
      su(JSBI.BigInt(0), JSBI.BigInt(10))
    )
    await repository.insertVerifiedStateUpdate(
      Address.default(),
      su(JSBI.BigInt(10), JSBI.BigInt(20))
    )

    const s = await repository.resolveStateUpdate(
      Address.default(),
      JSBI.BigInt(5)
    )
    expect(s).toEqual([su(JSBI.BigInt(0), JSBI.BigInt(5))])
  })

  test('resolve state update with multiple state updates', async () => {
    await repository.insertVerifiedStateUpdate(
      Address.default(),
      su(JSBI.BigInt(0), JSBI.BigInt(10))
    )
    await repository.insertVerifiedStateUpdate(
      Address.default(),
      su(JSBI.BigInt(10), JSBI.BigInt(20))
    )

    const resolvedStateUpdates = await repository.resolveStateUpdate(
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
    await repository.insertVerifiedStateUpdate(
      Address.default(),
      su(JSBI.BigInt(0), JSBI.BigInt(10))
    )
    await repository.insertVerifiedStateUpdate(
      Address.default(),
      su(JSBI.BigInt(10), JSBI.BigInt(20))
    )

    const resolvedStateUpdates = await repository.resolveStateUpdate(
      Address.default(),
      JSBI.BigInt(25)
    )
    expect(resolvedStateUpdates).toBeNull()
  })
})
