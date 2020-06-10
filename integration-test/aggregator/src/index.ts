import * as ethers from 'ethers'
import { Client } from 'pg'
import { Address, Bytes } from '@cryptoeconomicslab/primitives'
import { RangeDb } from '@cryptoeconomicslab/db'
import { PostgreSqlKeyValueStore } from '@cryptoeconomicslab/postgres-kvs'
import {
  DepositContract,
  CommitmentContract
} from '@cryptoeconomicslab/eth-contract'
import { EthWallet } from '@cryptoeconomicslab/eth-wallet'
import { EthCoder } from '@cryptoeconomicslab/eth-coder'
import { setupContext } from '@cryptoeconomicslab/context'
import { config } from 'dotenv'
config()

import Aggregator, {
  BlockManager,
  StateManager
} from '@cryptoeconomicslab/plasma-aggregator'
import Sentry from '@sentry/node'

import contractConfig from './config.local.json'
import tokenConfig from './tokenConfig.local.json'
const tConfig: {
  [key: string]: { DepositContract: string; TokenContract: string }
} = tokenConfig

if (process.env.SENTRY_ENDPOINT) {
  Sentry.init({
    dsn: process.env.SENTRY_ENDPOINT
  })
}

setupContext({
  coder: EthCoder
})

const instantiate = async (
  isSubmitter?: boolean,
  port?: number,
  blockInterval?: number
): Promise<Aggregator> => {
  const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT),
    password: process.env.DB_PASSWORD
  })
  const kvs = new PostgreSqlKeyValueStore(client)
  await kvs.open()
  const network = process.env.ETH_NETWORK
  const wallet = new EthWallet(
    new ethers.Wallet(
      process.env.AGGREGATOR_PRIVATE_KEY,
      network === undefined || network === 'local'
        ? new ethers.providers.JsonRpcProvider(process.env.MAIN_CHAIN_HOST)
        : ethers.getDefaultProvider(network)
    )
  )

  const stateBucket = await kvs.bucket(Bytes.fromString('state_update'))
  const stateDb = new RangeDb(stateBucket)
  const blockDb = await kvs.bucket(Bytes.fromString('block'))
  const stateManager = new StateManager(stateDb)
  const blockManager = new BlockManager(blockDb)
  const witnessDb = await kvs.bucket(Bytes.fromString('witness'))
  const eventDb = await kvs.bucket(Bytes.fromString('event'))
  function depositContractFactory(address: Address) {
    return new DepositContract(address, eventDb, wallet.getEthersWallet())
  }
  function commitmentContractFactory(address: Address) {
    return new CommitmentContract(address, eventDb, wallet.getEthersWallet())
  }

  return new Aggregator(
    wallet,
    stateManager,
    blockManager,
    witnessDb,
    depositContractFactory,
    commitmentContractFactory,
    contractConfig as any,
    {
      isSubmitter,
      blockInterval,
      port
    }
  )
}

async function main() {
  const aggregator = await instantiate(
    process.env.ROLE === 'submitter',
    Number(process.env.PORT),
    Number(process.env.BLOCK_INTERVAL)
  )
  aggregator.registerToken(
    Address.from(contractConfig.payoutContracts.DepositContract)
  )
  if (tConfig) {
    Object.keys(
      tConfig as {
        [key: string]: { DepositContract: string; TokenContract: string }
      }
    ).forEach(k => {
      aggregator.registerToken(
        Address.from(tConfig[k].DepositContract as string)
      )
    })
  }
  aggregator.run()
  console.log('aggregator is running on port ', process.env.PORT)
}

main()
