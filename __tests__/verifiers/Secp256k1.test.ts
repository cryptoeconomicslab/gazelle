import { secp256k1Verifier } from '../../src/verifiers'
import { Bytes } from '../../src/types/Codables'

describe('secp256k1Verifier', () => {
  const publicKey = Bytes.fromHexString(
    '0x5640A00fAE03fa40d527C27dc28E67dF140Fd995'
  )
  const message = Bytes.fromString('message')
  const signature = Bytes.fromHexString(
    '0x682f001aa66b904779bbcd846e52a62f4cf7d643b91826fdec04441ab604a6d66330609ad20a1a14fb52e3967bd2086c131e634ee4823b8a7ce3be8d91038daa1b'
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
