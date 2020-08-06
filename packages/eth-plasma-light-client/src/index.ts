import * as ethers from 'ethers'
import { EthWallet } from '@cryptoeconomicslab/eth-wallet'
import { Address, Bytes } from '@cryptoeconomicslab/primitives'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import {
  DepositContract,
  CommitmentContract,
  AdjudicationContract,
  OwnershipPayoutContract,
  ERC20Contract,
  CheckpointDisputeContract,
  ExitDisputeContract,
  EventWatcherOptions
} from '@cryptoeconomicslab/eth-contract'
import LightClient from '@cryptoeconomicslab/plasma-light-client'
import { DeciderConfig } from '@cryptoeconomicslab/ovm'
import { EthCoder } from '@cryptoeconomicslab/eth-coder'
import { setupContext } from '@cryptoeconomicslab/context'
import { PlasmaContractConfig } from '@cryptoeconomicslab/plasma'

type EthContractConfig = {
  PlasmaETH: string
}

setupContext({
  coder: EthCoder
})

interface EthLightClientOptions {
  wallet: ethers.Wallet
  provider?: ethers.providers.Provider
  kvs: KeyValueStore
  config: DeciderConfig & PlasmaContractConfig & EthContractConfig
  aggregatorEndpoint?: string
  eventWatcherOptions?: EventWatcherOptions
}

export default async function initialize(options: EthLightClientOptions) {
  const eventDb = await options.kvs.bucket(Bytes.fromString('event'))
  const ethWallet = new EthWallet(options.wallet, options.config)
  const adjudicationContract = new AdjudicationContract(
    Address.from(options.config.adjudicationContract),
    eventDb,
    options.wallet,
    options.provider,
    options.eventWatcherOptions
  )
  function depositContractFactory(address: Address) {
    return new DepositContract(
      address,
      eventDb,
      options.wallet,
      options.provider,
      options.eventWatcherOptions
    )
  }
  function tokenContractFactory(address: Address) {
    return new ERC20Contract(address, options.wallet)
  }
  const commitmentContract = new CommitmentContract(
    Address.from(options.config.commitment),
    eventDb,
    options.wallet,
    options.provider,
    options.eventWatcherOptions
  )
  const ownershipPayoutContract = new OwnershipPayoutContract(
    Address.from(options.config.payoutContracts['OwnershipPayout']),
    options.wallet
  )
  const checkpointDisputeContract = new CheckpointDisputeContract(
    Address.from(options.config.checkpointDispute),
    eventDb,
    options.wallet,
    options.provider,
    options.eventWatcherOptions
  )
  const exitDisputeContract = new ExitDisputeContract(
    Address.from(options.config.exitDispute),
    eventDb,
    options.wallet,
    options.provider,
    options.eventWatcherOptions
  )
  const client = await LightClient.initilize({
    wallet: ethWallet,
    witnessDb: options.kvs,
    adjudicationContract,
    depositContractFactory,
    tokenContractFactory,
    commitmentContract,
    ownershipPayoutContract,
    checkpointDisputeContract,
    exitDisputeContract,
    deciderConfig: options.config,
    aggregatorEndpoint: options.aggregatorEndpoint
  })
  await client.registerToken(
    options.config.PlasmaETH,
    options.config.payoutContracts['DepositContract']
  )
  return client
}
