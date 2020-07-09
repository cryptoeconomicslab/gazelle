import * as ethers from 'ethers'
import { BigNumber, Bytes } from '@cryptoeconomicslab/primitives'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import {
  EventDb,
  EventHandler,
  ErrorHandler,
  EventLog,
  IEventWatcher,
  CompletedHandler
} from '@cryptoeconomicslab/contract'
type Provider = ethers.providers.Provider

export interface EventWatcherOptions {
  interval?: number
  approval?: number
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

  private getEventId(txHash: string, logIndex: number) {
    return Bytes.concat([
      Bytes.fromHexString(txHash),
      Bytes.fromString(logIndex.toString())
    ])
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
    // clear timeout handler to keep only one event handler run at same time
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
    const approval = !this.options.approval ? 0 : this.options.approval
    const events = await this.httpProvider.getLogs({
      address: this.contractAddress,
      fromBlock: fromBlockNumber,
      toBlock: blockNumber - approval
    })
    for (const event of events) {
      if (!event.blockNumber) {
        continue
      }
      if (event.transactionHash && event.logIndex !== undefined) {
        const seen = await this.eventDb.getSeen(
          this.getEventId(event.transactionHash, event.logIndex)
        )
        if (seen) {
          continue
        }
      } else {
        continue
      }
      const logDesc = this.contractInterface.parseLog(event)
      if (!logDesc) {
        continue
      }

      const handler = this.checkingEvents.get(logDesc.name)
      if (handler) {
        const eventLog: EventLog = {
          mainchainBlockNumber: BigNumber.from(event.blockNumber),
          name: logDesc.name,
          values: logDesc.values
        }
        await handler(eventLog)
        if (event.transactionHash && event.logIndex !== undefined) {
          await this.eventDb.addSeen(
            this.getEventId(event.transactionHash, event.logIndex)
          )
        }
      }
    }
    await this.eventDb.setLastLoggedBlock(
      Bytes.fromString(this.contractAddress),
      blockNumber - approval
    )
    completedHandler()
  }
}
