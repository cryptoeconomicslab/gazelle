import express, { Express, Request, Response } from 'express'
import {
  CompiledPredicate,
  DeciderManager,
  DeciderConfig
} from '@cryptoeconomicslab/ovm'
import {
  Address,
  Bytes,
  BigNumber,
  Range
} from '@cryptoeconomicslab/primitives'
import {
  StateUpdate,
  TransactionReceipt,
  DepositTransaction,
  TRANSACTION_STATUS,
  Block,
  PlasmaContractConfig,
  SignedTransaction
} from '@cryptoeconomicslab/plasma'
import { KeyValueStore, getWitnesses } from '@cryptoeconomicslab/db'
import {
  ICommitmentContract,
  IDepositContract
} from '@cryptoeconomicslab/contract'
import { Wallet } from '@cryptoeconomicslab/wallet'

import { decodeStructable } from '@cryptoeconomicslab/coder'
import JSBI from 'jsbi'

import { BlockManager, StateManager } from './managers'
import { sleep } from './utils'
import cors from 'cors'
import { createSignatureHint } from '@cryptoeconomicslab/ovm/lib/hintString'
import BlockExplorerController from './BlockExplorer/controller'

export default class Aggregator {
  readonly decider: DeciderManager
  private depositContracts: IDepositContract[] = []
  private commitmentContract: ICommitmentContract
  private httpServer: Express
  private ownershipPredicate: CompiledPredicate
  private option: {
    isSubmitter: boolean
    port: number
    blockInterval: number
  }

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
    config: DeciderConfig & PlasmaContractConfig,
    {
      isSubmitter = false,
      port = 3000,
      blockInterval = 15000
    }: {
      isSubmitter?: boolean
      port?: number
      blockInterval?: number
    }
  ) {
    this.option = {
      isSubmitter,
      port,
      blockInterval
    }
    this.decider = new DeciderManager(witnessDb, ovmContext.coder)
    this.commitmentContract = commitmentContractFactory(
      Address.from(config.commitment)
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
    this.commitmentContract.subscribeBlockSubmitted(
      async (blockNumber, root, mainchainBlockNumber, mainchainTimestamp) => {
        await this.blockManager.updateBlock(
          blockNumber,
          mainchainBlockNumber,
          mainchainTimestamp
        )
      }
    )
    this.commitmentContract.startWatchingEvents()
    if (this.option.isSubmitter) {
      this.poll()
    }
  }

  /**
   * start http server
   */
  private runHttpServer() {
    this.httpServer.post('/send_tx', this.handleSendTransaction.bind(this))
    this.httpServer.get('/sync_state', this.handleGetSyncState.bind(this))
    this.httpServer.get('/block', this.handleGetBlock.bind(this))
    this.httpServer.get('/spent_proof', this.handleGetSpentProof.bind(this))
    this.httpServer.get(
      '/inclusion_proof',
      this.handleGetInclusionProof.bind(this)
    )
    this.httpServer.get(
      '/checkpoint_witness',
      this.handleGetCheckpointWitness.bind(this)
    )
    this.setupBlockExplorer()
    // NOTE: for debug API
    if (process.env.NODE_ENV === 'DEBUG') {
      this.httpServer.get('/faucet', this.handleFaucet.bind(this))
    }
    this.httpServer.listen(this.option.port, () =>
      console.log(`server is listening on port ${this.option.port}!`)
    )
  }

  private setupBlockExplorer() {
    const controller = new BlockExplorerController(
      this.blockManager,
      this.stateManager
    )

    this.httpServer.get(
      '/explorer/block',
      async (req: Request, res: Response) => {
        const blockNumber = BigNumber.from(Number(req.query.blockNumber))
        try {
          const json = await controller.handleBlock(blockNumber)
          res
            .send(json)
            .status(200)
            .end()
        } catch (e) {
          res
            .status(404)
            .send('Not found')
            .end(0)
        }
      }
    )

    this.httpServer.get(
      '/explorer/blocks',
      async (req: Request, res: Response) => {
        const from = req.query.from
          ? BigNumber.from(Number(req.query.from))
          : undefined
        const to = req.query.to
          ? BigNumber.from(Number(req.query.to))
          : undefined

        try {
          const json = await controller.handleBlockList({
            from,
            to
          })
          res
            .send(json)
            .status(200)
            .end()
        } catch (e) {
          res
            .status(404)
            .send('Not found')
            .end(0)
        }
      }
    )

    this.httpServer.get(
      '/explorer/transaction',
      async (req: Request, res: Response) => {
        const blockNumber = BigNumber.from(Number(req.query.blockNumber))
        const depositContractAddress = Address.from(
          req.query.depositContractAddress
        )
        const start = BigNumber.from(Number(req.query.start))
        const end = BigNumber.from(Number(req.query.end))

        try {
          const json = await controller.handleTransaction(
            blockNumber,
            depositContractAddress,
            start,
            end
          )
          res
            .send(json)
            .status(200)
            .end()
        } catch (e) {
          res
            .status(404)
            .send('Not found')
            .end(0)
        }
      }
    )

    this.httpServer.get(
      '/explorer/transactions',
      async (req: Request, res: Response) => {
        const blockNumber = BigNumber.from(Number(req.query.blockNumber))

        try {
          const json = await controller.handleTransactionList(blockNumber)
          res
            .send(json)
            .status(200)
            .end()
        } catch (e) {
          res
            .status(404)
            .send('Not found')
            .end(0)
        }
      }
    )
  }

  // TODO: what if part of the transactions are invalid?
  // respond 201 if more than one transactions are valid, otherwise respond 422.
  private async handleSendTransaction(req: Request, res: Response) {
    const { coder } = ovmContext
    const { data } = req.body
    const transactions: string[] = Array.isArray(data) ? data : [data]
    const nextBlockNumber = await this.blockManager.getNextBlockNumber()

    Promise.all(
      transactions.map(async d => {
        try {
          const tx = decodeStructable(
            SignedTransaction,
            coder,
            Bytes.fromHexString(d)
          )
          const receipt = await this.ingestTransaction(tx)
          return receipt
        } catch (e) {
          // return null transaction receipt with status is FALSE when error occur while decoding.
          return new TransactionReceipt(
            TRANSACTION_STATUS.FALSE,
            nextBlockNumber,
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
        if (
          receipts.some(receipt =>
            receipt.status.equals(TRANSACTION_STATUS.TRUE)
          )
        ) {
          res.status(201)
        } else {
          res.status(422)
        }
        res.end()
      })
      .catch(() => {
        res.status(422)
        res.end()
      })
  }

  private async handleGetSyncState(req: Request, res: Response) {
    let addr: Address
    const blockNumber = req.query.blockNumber
      ? BigNumber.from(Number(req.query.blockNumber))
      : undefined

    try {
      addr = Address.from(req.query.address)
    } catch (e) {
      return res.status(400).end()
    }
    try {
      const stateUpdates = (
        await Promise.all(
          this.depositContracts
            .map(d => d.address)
            .map(async depositContractAddress => {
              return await this.stateManager.queryOwnershipyStateUpdates(
                depositContractAddress,
                this.ownershipPredicate.deployedAddress,
                addr,
                blockNumber
              )
            })
        )
      ).reduce((acc, val) => [...acc, ...val], [])
      console.log(stateUpdates)
      res
        .send(
          stateUpdates.map(s =>
            ovmContext.coder.encode(s.toStruct()).toHexString()
          )
        )
        .status(200)
        .end()
    } catch (e) {
      console.log(e)
      res.status(500).end()
    }
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

  private async handleGetSpentProof(req: Request, res: Response) {
    try {
      const tokenAddress = Address.from(req.query.tokenAddress)
      const blockNumber = BigNumber.from(req.query.blockNumber)
      const rangeBytes = Bytes.fromHexString(req.query.range)
      const range = Range.fromBytes(rangeBytes)
      const includedTxs = await this.stateManager.getTxs(
        tokenAddress,
        blockNumber,
        range
      )
      res.send({
        data: includedTxs.map(tx =>
          ovmContext.coder.encode(tx.toStruct()).toHexString()
        )
      })
      res.status(200).end()
    } catch (e) {
      console.log(e)
      res.status(404).end()
    }
  }

  private handleGetInclusionProof(req: Request, res: Response) {
    try {
      const blockNumber = BigNumber.from(req.query.blockNumber)
      const stateUpdateByte = Bytes.fromHexString(req.query.stateUpdate)
      const stateUpdate = decodeStructable(
        StateUpdate,
        ovmContext.coder,
        stateUpdateByte
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
      console.log(e)
      res.status(404).end()
    }
  }

  /**
   * get inclusion proofs for given range of stateUpdates until
   * blockNumber specified with request parameter
   */
  private async handleGetCheckpointWitness(req: Request, res: Response) {
    const { coder } = ovmContext
    let blockNumber: BigNumber, range: Range, address: Address
    try {
      blockNumber = BigNumber.from(req.query.blockNumber)
      range = decodeStructable(
        Range,
        coder,
        Bytes.fromHexString(req.query.range)
      )
      address = Address.from(req.query.address)
    } catch (e) {
      res
        .status(400)
        .send('Invalid request arguments')
        .end()
      return
    }

    // get inclusionProofs
    let witnesses: Array<{
      stateUpdate: string
      txs: string[]
      inclusionProof: string | null
    }> = []
    for (
      let b = JSBI.BigInt(1);
      JSBI.lessThanOrEqual(b, blockNumber.data);
      b = JSBI.add(b, JSBI.BigInt(1))
    ) {
      const block = await this.blockManager.getBlock(BigNumber.from(b))
      if (!block) {
        res
          .status(400)
          .send(
            `Invalid request with blockNumber: ${blockNumber.data.toString()}`
          )
          .end()
        return
      }

      const sus = await this.stateManager.resolveStateUpdatesAtBlock(
        address,
        BigNumber.from(b),
        range.start,
        range.end
      )

      try {
        witnesses = witnesses.concat(
          await Promise.all(
            sus.map(async su => {
              const inclusionProof = block.getInclusionProof(su)
              const txs = await this.stateManager.getTxs(
                address,
                BigNumber.from(b),
                su.range
              )

              return {
                stateUpdate: coder.encode(su.toStruct()).toHexString(),
                inclusionProof: inclusionProof
                  ? coder.encode(inclusionProof.toStruct()).toHexString()
                  : null,
                txs: txs.map(tx => coder.encode(tx.toStruct()).toHexString())
              }
            })
          )
        )
      } catch (e) {
        console.log(e)
        res
          .send('witness not found: ' + String(e))
          .status(404)
          .end()
        return
      }
    }

    res
      .send({
        data: witnesses
      })
      .status(200)
      .end()
  }

  /**
   * TODO: implement faucet API
   * faucet dummy token for development when started in debug mode
   */
  private async handleFaucet(req: Request, res: Response) {
    throw new Error('not implemented')
  }

  /**
   * check if block manager is ready to submit new block.
   * if there are at least one new state update and passed BLOCK_INTERVAL,
   * generate next block and submit to commitment contract
   */
  private async poll() {
    await sleep(this.option.blockInterval)
    const block = await this.blockManager.generateNextBlock()
    if (block) {
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
    tx: SignedTransaction
  ): Promise<TransactionReceipt> {
    console.log('transaction received: ', tx.toString())
    const nextBlockNumber = await this.blockManager.getNextBlockNumber()
    const stateUpdates = await this.stateManager.resolveStateUpdates(
      tx.depositContractAddress,
      tx.range.start,
      tx.range.end
    )
    try {
      const nextState = await this.stateManager.executeStateTransition(
        tx,
        nextBlockNumber,
        this.decider
      )

      await this.blockManager.enqueuePendingStateUpdate(nextState)
      return new TransactionReceipt(
        TRANSACTION_STATUS.TRUE,
        nextBlockNumber,
        stateUpdates.map(su => su.blockNumber),
        tx.range,
        tx.depositContractAddress,
        tx.from,
        tx.getHash()
      )
    } catch (e) {
      console.log(e)
      return new TransactionReceipt(
        TRANSACTION_STATUS.FALSE,
        nextBlockNumber,
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
  ): (checkpointId: Bytes, checkpoint: StateUpdate) => Promise<void> {
    return async (checkpointId: Bytes, checkpoint: StateUpdate) => {
      const blockNumber = await this.blockManager.getCurrentBlockNumber()
      const tx = new DepositTransaction(depositContractAddress, checkpoint)
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
    depositContract.startWatchingEvents()
  }
}
