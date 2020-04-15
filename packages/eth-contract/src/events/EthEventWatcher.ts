import * as ethers from 'ethers'
import { Bytes } from '@cryptoeconomicslab/primitives'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import {
  EventDb,
  EventHandler,
  ErrorHandler,
  IEventWatcher,
  CompletedHandler
} from '@cryptoeconomicslab/contract'
type Provider = ethers.providers.Provider

export interface EventWatcherOptions {
  interval?: number
}

export type EthEventWatcherArgType = {
  provider: Provider
  kvs: KeyValueStore
  contractAddress: string
  contractInterface: ethers.utils.Interface
  options?: EventWatcherOptions
}

const DEFAULT_INTERVAL = 3000

export default class EventWatcher implements IEventWatcher {
  public httpProvider: Provider
  public eventDb: EventDb
  public checkingEvents: Map<string, EventHandler>
  public options: EventWatcherOptions
  public timer?: NodeJS.Timer
  public contractAddress: string
  public contractInterface: ethers.utils.Interface

  constructor({
    provider,
    kvs,
    contractAddress,
    contractInterface,
    options
  }: EthEventWatcherArgType) {
    this.httpProvider = provider
    this.eventDb = new EventDb(kvs)
    this.checkingEvents = new Map<string, EventHandler>()
    this.options = {
      interval: DEFAULT_INTERVAL,
      ...options
    }
    this.contractAddress = contractAddress
    this.contractInterface = contractInterface
  }

  public subscribe(event: string, handler: EventHandler) {
    // FIXME: add multiple handlers to one event
    this.checkingEvents.set(event, handler)
  }

  public unsubscribe(event: string, handler: EventHandler) {
    this.checkingEvents.delete(event)
  }

  public async start(handler: CompletedHandler, errorHandler?: ErrorHandler) {
    try {
      const block = await this.httpProvider.getBlock('latest')
      const loaded = await this.eventDb.getLastLoggedBlock(
        Bytes.fromString(this.contractAddress)
      )
      await this.poll(loaded + 1, block.number, handler)
    } catch (e) {
      console.log(e)
      if (errorHandler) {
        errorHandler(e)
      }
    }
    // clear timeout handler to keep only one event handler runs at same time
    this.cancel()
    this.timer = setTimeout(async () => {
      await this.start(handler, errorHandler)
    }, this.options.interval || DEFAULT_INTERVAL)
  }

  public cancel() {
    if (this.timer) {
      clearTimeout(this.timer)
    }
  }

  public async poll(
    fromBlockNumber: number,
    blockNumber: number,
    completedHandler: CompletedHandler
  ) {
    const events = await this.httpProvider.getLogs({
      address: this.contractAddress,
      fromBlock: fromBlockNumber,
      toBlock: blockNumber
    })

    const filtered = events
      .filter(async e => {
        if (e.transactionHash) {
          const seen = await this.eventDb.getSeen(
            Bytes.fromHexString(e.transactionHash)
          )
          return !seen
        } else {
          return false
        }
      })
      .map(e => {
        const logDesc = this.contractInterface.parseLog(e)
        if (!logDesc) return false
        const handler = this.checkingEvents.get(logDesc.name)
        if (handler) {
          handler(logDesc)
        }
        if (e.transactionHash) {
          this.eventDb.addSeen(Bytes.fromHexString(e.transactionHash))
        }
        return true
      })
    await this.eventDb.setLastLoggedBlock(
      Bytes.fromString(this.contractAddress),
      blockNumber
    )
    if (filtered.length > 0) {
      completedHandler()
    }
  }
}
