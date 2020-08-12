import { Address } from '@cryptoeconomicslab/primitives'
import { Block } from '@cryptoeconomicslab/plasma'
import { ICommitmentContract } from '@cryptoeconomicslab/contract'
import BlockManager from './managers/BlockManager'

export class TransactionSubmitter {
  private commitmentContract: ICommitmentContract

  /**
   * instantiate submitter
   * @param kvs key value store isntance
   */
  constructor(
    private blockManager: BlockManager,
    commitmentContractFactory: (address: Address) => ICommitmentContract,
    commitmentContractAddress: string
  ) {
    this.commitmentContract = commitmentContractFactory(
      Address.from(commitmentContractAddress)
    )
  }

  public async submit() {
    await this.submitNextBlock()
  }

  /**
   * if there are unsubmitted block, submit most old unsubmitted block, otherwise submit next block.
   */
  private async submitNextBlock() {
    const submitted = await this.blockManager.getSubmittedBlock()
    const nextSubmitBlock = submitted.increment()
    let nextBlock = await this.blockManager.getBlock(nextSubmitBlock)
    if (nextBlock === null) {
      nextBlock = await this.blockManager.generateNextBlock()
    }
    if (nextBlock) {
      await this.submitBlock(nextBlock)
    }
  }

  /**
   *  submit block to commitment contract and store new block
   */
  private async submitBlock(block: Block) {
    const root = block.getTree().getRoot()
    try {
      await this.commitmentContract.submit(block.blockNumber, root)
    } catch (e) {
      console.error(e)
      await this.syncSubmittedBlock()
      return
    }
    await this.blockManager.updateSubmittedBlock(block.blockNumber)
    console.log('submit block: ', block)
  }

  private async syncSubmittedBlock() {
    const submittedBlockNumber = await this.commitmentContract.getCurrentBlock()
    await this.blockManager.updateSubmittedBlock(submittedBlockNumber)
  }
}
