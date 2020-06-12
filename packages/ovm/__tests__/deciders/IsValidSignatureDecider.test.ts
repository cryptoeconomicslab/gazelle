import {
  DeciderManager,
  IsValidSignatureDecider,
  Property,
  ForAllSuchThatDecider,
  LogicalConnective
} from '../../src'
import { Address, Bytes } from '@cryptoeconomicslab/primitives'
import * as ethers from 'ethers'
import { Secp256k1Signer } from '@cryptoeconomicslab/signature'
import { InMemoryKeyValueStore } from '@cryptoeconomicslab/level-kvs'
import Coder from '@cryptoeconomicslab/coder'
import { setupContext } from '@cryptoeconomicslab/context'
import { ForAllSuchThatDeciderAddress } from '../helpers/initiateDeciderManager'
setupContext({ coder: Coder })

describe('IsValidSignatureDecider', () => {
  const addr = Address.from('0x0000000000000000000000000000000000000001')
  const db = new InMemoryKeyValueStore(Bytes.fromString('test'))
  const deciderManager = new DeciderManager(db)
  deciderManager.setDecider(
    ForAllSuchThatDeciderAddress,
    new ForAllSuchThatDecider(),
    LogicalConnective.ForAllSuchThat
  )
  deciderManager.setDecider(addr, new IsValidSignatureDecider())
  const wallet = ethers.Wallet.createRandom()
  let publicKey: string, privateKey: Bytes, message: Bytes, signature: Bytes

  beforeAll(async () => {
    publicKey = await wallet.getAddress()
    privateKey = Bytes.fromHexString(wallet.privateKey)
    message = Bytes.fromString('hello world')
    signature = await new Secp256k1Signer(privateKey).sign(message)
  })

  test('valid secp2561k signature', async () => {
    const property = new Property(addr, [
      message,
      signature,
      Coder.encode(Address.from(publicKey)),
      Bytes.fromString('secp256k1')
    ])

    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeTruthy()
  })

  test('invalid signature preimage', async () => {
    const property = new Property(addr, [
      message,
      Bytes.fromString('hellohello'),
      Coder.encode(Address.from(publicKey)),
      Bytes.fromString('secp256k1')
    ])

    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeFalsy()
  })

  test('invalid signature', async () => {
    const invalidSig = await new Secp256k1Signer(privateKey).sign(
      Bytes.fromString('invalid sig')
    )
    const property = new Property(addr, [
      message,
      invalidSig,
      Coder.encode(Address.from(publicKey)),
      Bytes.fromString('secp256k1')
    ])

    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeFalsy()
  })

  test('different signature algorithm', async () => {
    const property = new Property(addr, [
      message,
      signature,
      Coder.encode(Address.from(publicKey)),
      Bytes.fromString('ed25519')
    ])

    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeFalsy()
  })

  test('input tuple length is invalid', async () => {
    const property = new Property(addr, [message])

    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeFalsy()
  })
})
