import { FixedBytes, BigNumber, Integer } from '@cryptoeconomicslab/primitives'

export interface ICommitmentContract {
  submit(blockNumber: BigNumber, root: FixedBytes): Promise<void>

  getCurrentBlock(): Promise<BigNumber>

  getRoot(blockNumber: BigNumber): Promise<FixedBytes>

  subscribeBlockSubmitted(
    handler: (
      blockNumber: BigNumber,
      root: FixedBytes,
      mainchainBlockNumber: BigNumber,
      mainchainTimestamp: Integer
    ) => Promise<void>
  ): void

  startWatchingEvents(): void

  unsubscribeAll(): void
}
