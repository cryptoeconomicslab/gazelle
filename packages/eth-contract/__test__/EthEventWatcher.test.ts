/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
import EventWatcher from '../src/events/EthEventWatcher'
import { EventDb } from '@cryptoeconomicslab/contract'
import { mocked } from 'ts-jest/utils'
jest.mock('@cryptoeconomicslab/contract')
const undefindMock = jest.fn().mockResolvedValue(undefined)
let specifiedToBlock = 0
const funcGetLogs = async function(param: any): Promise<[]> {
  specifiedToBlock = param.toBlock
  return []
}
mocked(EventDb).mockImplementation((): any => {
  return {
    setLastLoggedBlock: undefindMock
  }
})
describe('EventWatcher', () => {
  describe('poll', () => {
    test('When the approval option is specified, the toBlock option is set to the current block number minus the value of approval.', async () => {
      const eventWatcher = new EventWatcher({
        provider: {
          getLogs: funcGetLogs
        } as any,
        kvs: {} as any,
        contractAddress: {} as any,
        contractInterface: this.connection.interface,
        options: {
          interval: 0,
          approval: 3
        }
      })
      specifiedToBlock = 0
      await eventWatcher.poll(0, 5, () => {})
      expect(specifiedToBlock).toBe(2)
    })
    test('When the approval option is not specified, the toBlock option is set to the current block number', async () => {
      const eventWatcher = new EventWatcher({
        provider: {
          getLogs: funcGetLogs
        } as any,
        kvs: {} as any,
        contractAddress: {} as any,
        contractInterface: this.connection.interface,
        options: {
          interval: 0
        }
      })
      specifiedToBlock = 0
      await eventWatcher.poll(0, 5, () => {})
      expect(specifiedToBlock).toBe(5)
    })
  })
})
