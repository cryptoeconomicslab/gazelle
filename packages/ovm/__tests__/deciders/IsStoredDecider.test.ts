import { Address, Bytes } from '@cryptoeconomicslab/primitives'
import { InMemoryKeyValueStore } from '@cryptoeconomicslab/level-kvs'
import {
  DeciderManager,
  IsStoredDecider,
  Property,
  ForAllSuchThatDecider,
  LogicalConnective
} from '../../src'
import Coder from '@cryptoeconomicslab/coder'
import { setupContext } from '@cryptoeconomicslab/context'
import { ForAllSuchThatDeciderAddress } from '../helpers/initiateDeciderManager'
setupContext({ coder: Coder })

describe('IsStoredDecider', () => {
  const addr = Address.from('0x0000000000000000000000000000000000000001')

  const address = Bytes.fromHexString(
    '0x0000000000000000000000000000000000000001'
  )
  const key = Bytes.fromHexString('0x01')
  const value = Bytes.fromHexString('0x01')
  const wrongValue = Bytes.fromHexString('0x02')
  let db: InMemoryKeyValueStore, deciderManager: DeciderManager

  beforeEach(() => {
    db = new InMemoryKeyValueStore(Bytes.fromString('test'))
    deciderManager = new DeciderManager(db)
    deciderManager.setDecider(
      ForAllSuchThatDeciderAddress,
      new ForAllSuchThatDecider(),
      LogicalConnective.ForAllSuchThat
    )
    deciderManager.setDecider(addr, new IsStoredDecider())
  })

  test('returns true when right value is stored', async () => {
    const db = await deciderManager.getStorageDb()
    const bucket = await db.bucket(address)
    await bucket.put(key, value)
    const property = new Property(addr, [address, key, value])
    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeTruthy()
  })

  test('returns false when wrong value is stored', async () => {
    const db = await deciderManager.getStorageDb()
    const bucket = await db.bucket(address)
    await bucket.put(key, wrongValue)
    const property = new Property(addr, [address, key, value])
    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeFalsy()
  })

  test('returns false when no value is stored', async () => {
    const property = new Property(addr, [address, key, value])
    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeFalsy()
  })
})
