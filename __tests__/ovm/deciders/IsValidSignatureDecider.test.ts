import { DeciderManager } from '../../../src/ovm/DeciderManager'
import { IsValidSignatureDecider } from '../../../src/ovm/deciders'
import { Property } from '../../../src/ovm/types'
import { Address, Bytes } from '../../../src/types/Codables'
import * as ethers from 'ethers'
import { SigningKey, arrayify, joinSignature, keccak256 } from 'ethers/utils'
import { InMemoryKeyValueStore } from '../../../src/db'

function sign(message: Bytes, key: SigningKey): Bytes {
  return Bytes.fromHexString(
    joinSignature(
      key.signDigest(arrayify(keccak256(arrayify(message.toHexString()))))
    )
  )
}

describe('IsValidSignatureDecider', () => {
  const addr = Address.from('0x0000000000000000000000000000000000000001')
  const db = new InMemoryKeyValueStore(Bytes.fromString('test'))
  const deciderManager = new DeciderManager(db)
  deciderManager.setDecider(addr, new IsValidSignatureDecider())
  const wallet = ethers.Wallet.createRandom()
  let publicKey: string,
    signingKey: SigningKey,
    message: Bytes,
    signature: Bytes

  beforeAll(async () => {
    publicKey = await wallet.getAddress()
    signingKey = new ethers.utils.SigningKey(wallet.privateKey)
    message = Bytes.fromString('hello world')
    signature = sign(message, signingKey)
  })

  test('valid secp2561k signature', async () => {
    const property = new Property(addr, [
      message,
      signature,
      Bytes.fromHexString(Address.from(publicKey).raw),
      Bytes.fromString('secp256k1')
    ])

    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeTruthy()
  })

  test('invalid signature preimage', async () => {
    const property = new Property(addr, [
      message,
      Bytes.fromString('hellohello'),
      Bytes.fromHexString(Address.from(publicKey).raw),
      Bytes.fromString('secp256k1')
    ])

    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeFalsy()
  })

  test('invalid signature', async () => {
    const invalidSig = sign(Bytes.fromString('invalid sig'), signingKey)
    const property = new Property(addr, [
      message,
      invalidSig,
      Bytes.fromHexString(Address.from(publicKey).raw),
      Bytes.fromString('secp256k1')
    ])

    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeFalsy()
  })

  test('different signature algorithm', async () => {
    const property = new Property(addr, [
      message,
      signature,
      Bytes.fromHexString(Address.from(publicKey).raw),
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
