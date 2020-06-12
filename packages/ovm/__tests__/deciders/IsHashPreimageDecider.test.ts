import { Address, Bytes } from '@cryptoeconomicslab/primitives'
import { Keccak256 } from '@cryptoeconomicslab/hash'
import { InMemoryKeyValueStore } from '@cryptoeconomicslab/level-kvs'
import {
  DeciderManager,
  IsHashPreimageDecider,
  Property,
  ForAllSuchThatDecider,
  LogicalConnective
} from '../../src'
import Coder from '@cryptoeconomicslab/coder'
import { setupContext } from '@cryptoeconomicslab/context'
import { ForAllSuchThatDeciderAddress } from '../helpers/initiateDeciderManager'
setupContext({ coder: Coder })

describe('IsHashPreimageDecider', () => {
  const addr = Address.from('0x0000000000000000000000000000000000000001')
  const db = new InMemoryKeyValueStore(Bytes.fromString('test'))
  const deciderManager = new DeciderManager(db)
  deciderManager.setDecider(
    ForAllSuchThatDeciderAddress,
    new ForAllSuchThatDecider(),
    LogicalConnective.ForAllSuchThat
  )
  deciderManager.setDecider(addr, new IsHashPreimageDecider())

  const preimage = Bytes.fromString('plasma is awesome!!')
  const hash = Keccak256.hash(preimage)

  test('valid hash preimage', async () => {
    const property = new Property(addr, [hash, preimage])

    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeTruthy()
  })

  test('invalid hash preimage', async () => {
    const property = new Property(addr, [
      hash,
      Bytes.fromString('falsey preimage')
    ])

    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeFalsy()
  })

  test('input tuple length is invalid', async () => {
    const property = new Property(addr, [hash])

    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeFalsy()
  })
})
