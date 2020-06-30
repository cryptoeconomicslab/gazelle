import { BigNumber } from '@cryptoeconomicslab/primitives'

export default interface EventLog {
  mainchainBlockNumber: BigNumber
  name: string
  values: any
}
