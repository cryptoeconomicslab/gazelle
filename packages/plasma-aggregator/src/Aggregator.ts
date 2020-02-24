import express, { Express, Request, Response } from 'express'
import {
  CompiledPredicate,
  DeciderManager,
  Property,
  InitilizationConfig
} from '@cryptoeconomicslab/ovm'
import {
  Address,
  Bytes,
  BigNumber,
  Range
} from '@cryptoeconomicslab/primitives'
import {
  StateUpdate,
  Transaction,
  TransactionReceipt,
  DepositTransaction,
  TRANSACTION_STATUS,
  Block
} from '@cryptoeconomicslab/plasma'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import {
  ICommitmentContract,
  IDepositContract
} from '@cryptoeconomicslab/contract'
import { Wallet } from '@cryptoeconomicslab/wallet'

import { decodeStructable } from '@cryptoeconomicslab/coder'

import { BlockManager, StateManager } from './managers'
import { sleep } from './utils'
import cors from 'cors'

const HTTP_PORT = Number(process.env.PORT || 3000)
const BLOCK_INTERVAL = Number(process.env.BLOCK_INTERVAL || 10000)
const COMMITMENT_CONTRACT_ADDRESS = process.env
  .COMMITMENT_CONTRACT_ADDRESS as string

export default class Aggregator {
  readonly decider: DeciderManager
  private depositContracts: IDepositContract[] = []
  private commitmentContract: ICommitmentContract
  private httpServer: Express
  private ownershipPredicate: CompiledPredicate

  /**
   * instantiate aggregator
   * @param kvs key value store isntance
   */
  constructor(
    private wallet: Wallet,
    private stateManager: StateManager,
    private blockManager: BlockManager,
    private witnessDb: KeyValueStore,
    private depositContractFactory: (address: Address) => IDepositContract,
    commitmentContractFactory: (address: Address) => ICommitmentContract,
    config: InitilizationConfig
  ) {
    this.decider = new DeciderManager(witnessDb, ovmContext.coder)
    this.commitmentContract = commitmentContractFactory(
      Address.from(COMMITMENT_CONTRACT_ADDRESS)
    )
    this.decider.loadJson(config)
    const ownershipPredicate = this.decider.compiledPredicateMap.get(
      'Ownership'
    )
    if (ownershipPredicate === undefined) {
      throw new Error('Ownership not found')
    }
    this.ownershipPredicate = ownershipPredicate
    this.httpServer = express()
    this.httpServer.use(express.json())
    this.httpServer.use(cors())
  }

  /**
   * start running http server and watching for deposit contracts deposit events
   */
  public run() {
    this.runHttpServer()
    this.poll()
  }

  /**
   * start http server
   */
  private runHttpServer() {
    this.httpServer.post('/send_tx', this.handleSendTransaction.bind(this))
    this.httpServer.get('/sync_state', this.handleGetSyncState.bind(this))
    this.httpServer.get('/block', this.handleGetBlock.bind(this))
    this.httpServer.get(
      '/inclusion_proof',
      this.handleGetInclusionProof.bind(this)
    )

    this.httpServer.listen(HTTP_PORT, () =>
      console.log(`server is listening on port ${HTTP_PORT}!`)
    )
  }

  // TODO: what if part of the transactions are invalid?
  private handleSendTransaction(req: Request, res: Response) {
    const { data } = req.body
    const transactions: string[] = Array.isArray(data) ? data : [data]

    Promise.all(
      transactions.map(async d => {
        try {
          const decodedStruct = ovmContext.coder.decode(
            Transaction.getParamTypes(),
            Bytes.fromHexString(d)
          )
          const tx = Transaction.fromStruct(decodedStruct)
          const receipt = await this.ingestTransaction(tx)
          return receipt
        } catch (e) {
          // return null transaction receipt with status is FALSE when error occur while decoding.
          return new TransactionReceipt(
            TRANSACTION_STATUS.FALSE,
            this.blockManager.nextBlockNumber,
            [],
            new Range(BigNumber.default(), BigNumber.default()),
            Address.default(),
            Address.default(),
            Bytes.default()
          )
        }
      })
    )
      .then(receipts => {
        res.send(
          receipts.map(receipt =>
            ovmContext.coder.encode(receipt.toStruct()).toHexString()
          )
        )
        res.status(201)
        res.end()
      })
      .catch(() => {
        res.status(422)
        res.end()
      })
  }

  private handleGetSyncState(req: Request, res: Response) {
    let addr
    const blockNumber = req.query.blockNumber
      ? BigNumber.from(Number(req.query.blockNumber))
      : undefined

    try {
      addr = Address.from(req.query.address)
    } catch (e) {
      return res.status(400).end()
    }
    this.stateManager
      .queryOwnershipyStateUpdates(
        this.ownershipPredicate.deployedAddress,
        addr,
        blockNumber
      )
      .then(data => {
        res.send(
          data.map(s =>
            ovmContext.coder.encode(s.property.toStruct()).toHexString()
          )
        )
        res.status(200).end()
      })
      .catch(e => {
        console.log(e)
        res.status(500).end()
      })
  }

  private handleGetBlock(req: Request, res: Response) {
    try {
      const blockNumber = BigNumber.from(req.query.blockNumber)
      this.blockManager.getBlock(blockNumber).then(block => {
        if (!block) {
          res.status(404).end()
          return
        }

        res.send({
          data: ovmContext.coder.encode(block.toStruct()).toHexString()
        })
        res.status(200).end()
      })
    } catch (e) {
      console.log(e)
      res.status(400).end()
    }
  }

  private handleGetInclusionProof(req: Request, res: Response) {
    try {
      const blockNumber = BigNumber.from(req.query.blockNumber)
      const stateUpdateByte = Bytes.fromHexString(req.query.stateUpdate)
      const stateUpdate = StateUpdate.fromProperty(
        decodeStructable(Property, ovmContext.coder, stateUpdateByte)
      )
      this.blockManager.getBlock(blockNumber).then(block => {
        if (!block) {
          res.status(404)
          res.end()
          return
        }
        const proof = block.getInclusionProof(stateUpdate)
        if (!proof) {
          res.status(404)
          res.end()
          return
        }
        res.send({
          data: ovmContext.coder.encode(proof.toStruct()).toHexString()
        })
        res.status(200).end()
      })
    } catch (e) {
      res.status(404).end()
    }
  }

  /**
   * check if block manager is ready to submit new block.
   * if there are at least one new state update and passed BLOCK_INTERVAL,
   * generate next block and submit to commitment contract
   */
  private async poll() {
    await sleep(BLOCK_INTERVAL)
    if (this.blockManager.isReady) {
      const block = await this.blockManager.generateNextBlock()
      await this.submitBlock(block)
    }
    await this.poll()
  }

  /**
   *  submit next block to commitment contract and store new block
   */
  private async submitBlock(block: Block) {
    const root = block.getTree().getRoot()
    await this.commitmentContract.submit(block.blockNumber, root)
    console.log('submit block: ', block)
  }

  /**
   * verify if sent transaction is valid to update its range
   * if valid, put it in transaction queue which is a queue
   * to be included in next block.
   * @param tx transaction sent by user
   */
  private async ingestTransaction(
    tx: Transaction
  ): Promise<TransactionReceipt> {
    console.log('transaction received: ', tx.range, tx.depositContractAddress)
    const stateUpdates = await this.stateManager.resolveStateUpdates(
      tx.range.start,
      tx.range.end
    )
    try {
      const nextState = await this.stateManager.executeStateTransition(
        tx,
        this.blockManager.nextBlockNumber,
        this.decider
      )

      await this.blockManager.enqueuePendingStateUpdate(nextState)
      return new TransactionReceipt(
        TRANSACTION_STATUS.TRUE,
        this.blockManager.nextBlockNumber,
        stateUpdates.map(su => su.blockNumber),
        tx.range,
        tx.depositContractAddress,
        tx.from,
        tx.getHash()
      )
    } catch (e) {
      return new TransactionReceipt(
        TRANSACTION_STATUS.FALSE,
        this.blockManager.nextBlockNumber,
        stateUpdates.map(su => su.blockNumber),
        tx.range,
        tx.depositContractAddress,
        tx.from,
        tx.getHash()
      )
    }
  }

  /**
   * factory to generate deposit handler
   * @param depositContract deposit contract address
   */
  private depositHandlerFactory(
    depositContractAddress: Address
  ): (checkpointId: Bytes, checkpoint: [Range, Property]) => void {
    return (checkpointId: Bytes, checkpoint: [Range, Property]) => {
      const stateUpdate = checkpoint[1]
      stateUpdate.inputs[1] = ovmContext.coder.encode(checkpoint[0].toStruct())
      const tx = new DepositTransaction(depositContractAddress, stateUpdate)
      const blockNumber = this.blockManager.currentBlockNumber
      this.stateManager.insertDepositRange(tx, blockNumber)
    }
  }

  /**
   * register new token to be handled by this plasma
   * @param tokenAddress deposit contract address to register
   */
  public registerToken(tokenAddress: Address) {
    console.log('register token: ', tokenAddress.data)
    this.blockManager.registerToken(tokenAddress)
    const depositContract = this.depositContractFactory(tokenAddress)
    this.depositContracts.push(depositContract)
    depositContract.subscribeCheckpointFinalized(
      this.depositHandlerFactory(depositContract.address)
    )
  }
}
