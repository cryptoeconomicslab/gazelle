import { Address, Bytes, BigNumber } from '@cryptoeconomicslab/primitives'
import { ethers } from 'ethers'
import { Balance } from '@cryptoeconomicslab/wallet'
import {
  Secp256k1Signer,
  secp256k1Verifier
} from '@cryptoeconomicslab/signature'

export const generateRandomWallet = () => {
  const w = ethers.Wallet.createRandom()
  const signingKey = new ethers.utils.SigningKey(w.privateKey)
  const address = w.address

  return {
    getAddress: () => Address.from(address),
    getL1Balance: async (tokenAddress?: Address) => {
      return new Balance(BigNumber.from(0), 18, 'eth')
    },
    signMessage: async (message: Bytes) => {
      const signer = new Secp256k1Signer(
        Bytes.fromHexString(signingKey.privateKey)
      )
      return signer.sign(message)
    },
    verifyMySignature: async (message: Bytes, signature: Bytes) => {
      const publicKey = Bytes.fromHexString(address)
      return await secp256k1Verifier.verify(message, signature, publicKey)
    }
  }
}
