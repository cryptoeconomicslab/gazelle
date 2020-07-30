import axios from 'axios'
import { Address, BigNumber, Range } from '@cryptoeconomicslab/primitives'
import { StateUpdate, Transaction } from '@cryptoeconomicslab/plasma'

class APIClient {
  constructor(readonly endpoint: string) {}

  syncState(address: string, blockNumber?: BigNumber) {
    if (blockNumber) {
      return axios.get(
        `${
          this.endpoint
        }/sync_state?address=${address}&blockNumber=${blockNumber.data.toString()}`
      )
    } else {
      return axios.get(`${this.endpoint}/sync_state?address=${address}`)
    }
  }
  spentProof(tokenAddress: Address, blockNumber: BigNumber, range: Range) {
    return axios.get(
      `${this.endpoint}/spent_proof?tokenAddress=${
        tokenAddress.data
      }&blockNumber=${blockNumber.data.toString()}&range=${range
        .toBytes()
        .toHexString()}`
    )
  }
  inclusionProof(su: StateUpdate) {
    return axios.get(
      `${
        this.endpoint
      }/inclusion_proof?blockNumber=${su.blockNumber.data.toString()}&stateUpdate=${ovmContext.coder
        .encode(su.property.toStruct())
        .toHexString()}`
    )
  }
  sendTransaction(tx: Transaction[] | Transaction) {
    const data = Array.isArray(tx)
      ? tx.map(x => ovmContext.coder.encode(x.toStruct()).toHexString())
      : ovmContext.coder.encode(tx.toStruct()).toHexString()

    return axios.post(`${this.endpoint}/send_tx`, {
      data
    })
  }
  checkpointWitness(address: Address, blockNumber: BigNumber, range: Range) {
    return axios.get(
      `${this.endpoint}/checkpoint_witness?address=${
        address.data
      }&blockNumber=${blockNumber.data.toString()}&range=${ovmContext.coder
        .encode(range.toStruct())
        .toHexString()}`
    )
  }
}

export default APIClient
