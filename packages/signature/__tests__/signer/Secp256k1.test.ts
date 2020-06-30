import { Secp256k1Signer, Signer } from '../../src/signer'
import { Bytes } from '@cryptoeconomicslab/primitives'

describe('secp256k1Signer', () => {
  const privateKey = Bytes.fromHexString(
    '0x27c1fd11b5802634df90c30a2ae8eb6c22c3b5523115a2d8aa6de81fc01024f7'
  )
  const message = Bytes.fromString('message')
  const anotherMessage = Bytes.fromString('another message')
  const testSignature = Bytes.fromHexString(
    '0x682f001aa66b904779bbcd846e52a62f4cf7d643b91826fdec04441ab604a6d66330609ad20a1a14fb52e3967bd2086c131e634ee4823b8a7ce3be8d91038daa1b'
  )
  let signer: Signer

  beforeEach(() => {
    signer = new Secp256k1Signer(privateKey)
  })

  it('return signature', async () => {
    const signature = await signer.sign(message)
    expect(signature.toHexString()).toEqual(testSignature.toHexString())
  })

  it('return another signature from another message', async () => {
    const signature = await signer.sign(anotherMessage)
    expect(signature).not.toEqual(testSignature)
  })

  it('throw exception with empty message', async () => {
    const signer = new Secp256k1Signer(Bytes.default())
    expect(signer.sign(Bytes.default())).rejects.toEqual(
      new Error('invalid length of privateKey')
    )
  })
})
