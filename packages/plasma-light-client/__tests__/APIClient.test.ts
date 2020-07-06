import APIClient from '../src/APIClient'
import axios from 'axios'
import {
  BigNumber,
  Address,
  Property,
  Range
} from '@cryptoeconomicslab/primitives'
import { StateUpdate, Transaction } from '@cryptoeconomicslab/plasma'
import { setupContext } from '@cryptoeconomicslab/context'
import JsonCoder from '@cryptoeconomicslab/coder'
setupContext({ coder: JsonCoder })

jest.mock('axios')

describe('APIClient', () => {
  beforeEach(async () => {
    const mockGet = axios.get as jest.Mock
    const mockPost = axios.post as jest.Mock
    mockGet.mockClear()
    mockPost.mockClear()
  })
  describe('syncState', () => {
    test('call syncState', async () => {
      const apiClient = new APIClient('http://test.com')
      await apiClient.syncState('', BigNumber.from(0))
      expect(axios.get).toHaveBeenCalledWith(
        'http://test.com/sync_state?address=&blockNumber=0'
      )
    })
  })

  describe('inclusionProof', () => {
    test('call inclusionProof', async () => {
      const apiClient = new APIClient('http://test.com')
      await apiClient.inclusionProof(
        new StateUpdate(
          Address.default(),
          Address.default(),
          new Range(BigNumber.from(0), BigNumber.from(10)),
          BigNumber.default(),
          new Property(Address.default(), [])
        )
      )
      expect(axios.get).toHaveBeenCalledWith(
        'http://test.com/inclusion_proof?blockNumber=0&stateUpdate=0x5b22307830303030303030303030303030303030303030303030303030303030303030303030303030303030222c5b22307832323330373833303330333033303330333033303330333033303330333033303330333033303330333033303330333033303330333033303330333033303330333033303330333033303330333033303330333033303232222c2230783562323233303232326332323331333032323564222c223078323233303232222c2230783562323233303738333033303330333033303330333033303330333033303330333033303330333033303330333033303330333033303330333033303330333033303330333033303330333033303330333033303330333032323263356235643564225d5d'
      )
    })
  })

  describe('sendTransaction', () => {
    const apiClient = new APIClient('http://test.com')
    const tx = new Transaction(
      Address.default(),
      new Range(BigNumber.from(0), BigNumber.from(10)),
      BigNumber.default(),
      new Property(Address.default(), []),
      Address.default()
    )
    test('call sendTransaction', async () => {
      await apiClient.sendTransaction(tx)
      expect(axios.post).toHaveBeenCalledWith('http://test.com/send_tx', {
        data:
          '0x5b22307830303030303030303030303030303030303030303030303030303030303030303030303030303030222c5b2230222c223130225d2c2230222c5b22307830303030303030303030303030303030303030303030303030303030303030303030303030303030222c5b5d5d2c22307830303030303030303030303030303030303030303030303030303030303030303030303030303030222c223078225d'
      })
    })

    test('call sendTransaction with transactions', async () => {
      await apiClient.sendTransaction([tx])
      expect(axios.post).toHaveBeenCalledWith('http://test.com/send_tx', {
        data: [
          '0x5b22307830303030303030303030303030303030303030303030303030303030303030303030303030303030222c5b2230222c223130225d2c2230222c5b22307830303030303030303030303030303030303030303030303030303030303030303030303030303030222c5b5d5d2c22307830303030303030303030303030303030303030303030303030303030303030303030303030303030222c223078225d'
        ]
      })
    })
  })
})
