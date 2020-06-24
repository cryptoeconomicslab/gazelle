import { secp256k1Verifier } from '../../src/verifier'
import { Bytes } from '@cryptoeconomicslab/primitives'

describe('secp256k1Verifier', () => {
  const publicKey = Bytes.fromHexString(
    '0x5640A00fAE03fa40d527C27dc28E67dF140Fd995'
  )
  const message = Bytes.fromString('message')
  const signature = Bytes.fromHexString(
    '0x87c2acee573d93e025a8d31e9d95df89e0a2982e0c65d42c3405f1c8b5e26f106c2bc437f2af9cbdde0d84c42e92177138a0ac32347cdb23c03097e5f4afd0c11c'
  )
  const invalidSignature = Bytes.fromHexString(
    '0x258be95aa1b4b86ca2a931bc95a648b2be79e8002e93ea4ffb416ad526b676a87e1776ebe8b0ea861b4e797c82023146de0b930b86ea49aa0fb2b9fcc5f30b931b'
  )
  const emptySignature = Bytes.default()

  it('return true with valid signature', async () => {
    const verify = await secp256k1Verifier.verify(message, signature, publicKey)
    expect(verify).toBeTruthy()
  })

  it('return false with invalid signature', async () => {
    const verify = await secp256k1Verifier.verify(
      message,
      invalidSignature,
      publicKey
    )
    expect(verify).toBeFalsy()
  })

  it('throw exception with empty signature', async () => {
    expect(() => {
      secp256k1Verifier.verify(message, emptySignature, publicKey)
    }).toThrow(new Error('invalid signature'))
  })
})
