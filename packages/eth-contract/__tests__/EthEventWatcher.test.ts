/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
import EventWatcher from '../src/events/EthEventWatcher'
import { EventDb } from '@cryptoeconomicslab/contract'
import { mocked } from 'ts-jest/utils'
import { Bytes } from '@cryptoeconomicslab/primitives'
jest.mock('@cryptoeconomicslab/contract')
const undefindMock = jest.fn().mockResolvedValue(undefined)
let specifiedToBlock = 0
let specifiedLoggedToBlock = 0
const funcGetLogs = async function(param: any): Promise<[]> {
  specifiedToBlock = param.toBlock
  return []
}
const funcSetLastLoggedBlock = async function(
  _: Bytes,
  blockNumber: number
): Promise<void> {
  specifiedLoggedToBlock = blockNumber
}
mocked(EventDb).mockImplementation((): any => {
  return {
    setLastLoggedBlock: funcSetLastLoggedBlock
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
        contractInterface: {} as any,
        options: {
          interval: 0,
          approval: 3
        }
      })
      specifiedToBlock = 0
      specifiedLoggedToBlock = 0
      await eventWatcher.poll(0, 5, () => {})
      expect(specifiedToBlock).toBe(2)
      expect(specifiedLoggedToBlock).toBe(2)
    })
    test('When the approval option is not specified, the toBlock option is set to the current block number', async () => {
      const eventWatcher = new EventWatcher({
        provider: {
          getLogs: funcGetLogs
        } as any,
        kvs: {} as any,
        contractAddress: {} as any,
        contractInterface: {} as any,
        options: {
          interval: 0
        }
      })
      specifiedToBlock = 0
      specifiedLoggedToBlock = 0
      await eventWatcher.poll(0, 5, () => {})
      expect(specifiedToBlock).toBe(5)
      expect(specifiedLoggedToBlock).toBe(5)
    })
  })
})
