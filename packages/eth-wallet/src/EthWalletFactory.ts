import { Wallet, WalletFactory } from '@cryptoeconomicslab/wallet'
import { DeciderConfig } from '@cryptoeconomicslab/ovm'
import { EthWallet } from './EthWallet'
import * as ethers from 'ethers'
import Provider = ethers.providers.Provider

export class EthWalletFactory implements WalletFactory {
  // Default provider will connect to eth main net
  provider: Provider = ethers.getDefaultProvider()
  constructor(readonly config: DeciderConfig, provider?: Provider) {
    if (provider) {
      this.provider = provider
    }
  }

  async fromPrivateKey(privateKey: string): Promise<Wallet> {
    return new EthWallet(
      new ethers.Wallet(privateKey, this.provider),
      this.config
    )
  }
}
