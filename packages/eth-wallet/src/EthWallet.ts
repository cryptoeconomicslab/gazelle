import * as ethers from 'ethers'
import { SigningKey } from 'ethers/utils'
import { secp256k1Verifier } from '@cryptoeconomicslab/signature'
import { Address, Bytes, BigNumber } from '@cryptoeconomicslab/primitives'
import { Wallet, Balance } from '@cryptoeconomicslab/wallet'
import { signTypedDataLegacy } from 'eth-sig-util'
import { createTypedParams, DeciderConfig } from '@cryptoeconomicslab/ovm'

const ERC20abi = [
  'function balanceOf(address tokenOwner) view returns (uint)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint)'
]

export class EthWallet implements Wallet {
  private ethersWallet: ethers.Wallet
  private signingKey: SigningKey

  constructor(ethersWallet: ethers.Wallet, readonly config: DeciderConfig) {
    this.ethersWallet = ethersWallet
    this.signingKey = new SigningKey(this.ethersWallet.privateKey)
  }

  public getEthersWallet(): ethers.Wallet {
    return this.ethersWallet
  }

  public getAddress(): Address {
    return Address.from(this.signingKey.address)
  }

  public async getL1Balance(tokenAddress?: Address): Promise<Balance> {
    let value: BigNumber, decimals: number, symbol: string
    if (tokenAddress) {
      const contract = new ethers.Contract(
        tokenAddress.data,
        ERC20abi,
        this.ethersWallet.provider
      )
      const ERC20 = contract.connect(this.ethersWallet)
      const balance = await ERC20.balanceOf(this.getAddress().data)
      value = BigNumber.fromString(balance.toString())
      decimals = Number(await ERC20.decimals())
      symbol = await ERC20.symbol()
    } else {
      const balance = await this.ethersWallet.getBalance()
      value = BigNumber.fromString(balance.toString())
      decimals = 18
      symbol = 'ETH'
    }
    return new Balance(value, decimals, symbol)
  }

  /**
   * signMessage signed a hex string message
   * @param message is hex string
   */
  public async signMessage(message: Bytes): Promise<Bytes> {
    return Bytes.fromHexString(
      signTypedDataLegacy(
        Buffer.from(Bytes.fromHexString(this.ethersWallet.privateKey).data),
        createTypedParams(this.config, message)
      )
    )
  }

  /**
   * verify signature
   * secp256k1 doesn't need a public key to verify the signature
   */
  public async verifyMySignature(
    message: Bytes,
    signature: Bytes
  ): Promise<boolean> {
    const publicKey = Bytes.fromHexString(this.getAddress().data)
    return await secp256k1Verifier.verify(message, signature, publicKey)
  }

  /**
   * Get contract instance which connecting by this wallet.
   * @param wallet
   * @param contractAddress
   * @param abi
   */
  private getConnection(contractAddress: Address, abi: string[]) {
    const ethersWallet = this.ethersWallet
    const contract = new ethers.Contract(
      contractAddress.data,
      abi,
      ethersWallet.provider
    )
    return contract.connect(ethersWallet)
  }
}
