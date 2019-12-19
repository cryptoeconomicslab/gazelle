import {
  splitSignature,
  recoverAddress,
  arrayify,
  keccak256
} from 'ethers/utils'
import SignatureVerifier from './SignatureVerifier'
import { Bytes } from '../types/Codables'

export const secp256k1Verifier: SignatureVerifier = {
  verify: (message: Bytes, signature: Bytes, publicKey: Bytes) => {
    const sig = splitSignature(signature.toHexString())
    const addr = recoverAddress(
      arrayify(keccak256(arrayify(message.data))),
      sig
    )
    return Promise.resolve(
      addr.toLocaleLowerCase() === publicKey.toHexString().toLocaleLowerCase()
    )
  }
}
