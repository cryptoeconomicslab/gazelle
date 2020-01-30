import {
  splitSignature,
  recoverAddress,
  arrayify,
  keccak256,
  hexZeroPad
} from 'ethers/utils'
import SignatureVerifier from './SignatureVerifier'
import { Bytes } from '@cryptoeconomicslab/primitives'

export const secp256k1Verifier: SignatureVerifier = {
  verify: (message: Bytes, signature: Bytes, publicKey: Bytes) => {
    const sig = splitSignature(signature.toHexString())
    const addr = recoverAddress(
      arrayify(keccak256(arrayify(message.data))),
      sig
    )

    // padZero because addresses encoded with ethers.js have leading zeros.
    return Promise.resolve(
      hexZeroPad(addr.toLocaleLowerCase(), 32) ===
        hexZeroPad(publicKey.toHexString().toLocaleLowerCase(), 32)
    )
  }
}
