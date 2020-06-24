import { Secp256k1Signer, Signer } from '../../src/signer'
import { Bytes } from '@cryptoeconomicslab/primitives'

describe('secp256k1Signer', () => {
  const privateKey = Bytes.fromHexString(
    '0x27c1fd11b5802634df90c30a2ae8eb6c22c3b5523115a2d8aa6de81fc01024f7'
  )
  const message = Bytes.fromString('message')
  const anotherMessage = Bytes.fromString('another message')
  const testSignature = Bytes.fromHexString(
    '0x87c2acee573d93e025a8d31e9d95df89e0a2982e0c65d42c3405f1c8b5e26f106c2bc437f2af9cbdde0d84c42e92177138a0ac32347cdb23c03097e5f4afd0c11c'
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
