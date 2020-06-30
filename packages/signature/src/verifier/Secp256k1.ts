import { keccak256 } from 'ethers/utils/keccak256'
import { recoverAddress } from 'ethers/utils/secp256k1'
import { arrayify, splitSignature, hexZeroPad } from 'ethers/utils/bytes'
import SignatureVerifier from './SignatureVerifier'
import { Bytes } from '@cryptoeconomicslab/primitives'

export const secp256k1Verifier: SignatureVerifier = {
  verify: (message: Bytes, signature: Bytes, publicKey: Bytes) => {
    const sig = splitSignature(signature.toHexString())
    const addr = recoverAddress(
      arrayify(keccak256(arrayify(message.data))),
      sig
    )
    console.log('recoverAddress', addr)

    // padZero because addresses encoded with ethers.js have leading zeros.
    return Promise.resolve(
      hexZeroPad(addr.toLocaleLowerCase(), 32) ===
        hexZeroPad(publicKey.toHexString().toLocaleLowerCase(), 32)
    )
  }
}
