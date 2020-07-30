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
let specifiedFromBlock = 0
let specifiedLoggedToBlock = 0
const funcGetLogs = async function(param: any): Promise<[]> {
  specifiedFromBlock = param.fromBlock
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
    test('If fromBlock is less than 0, it becomes 0..', async () => {
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
      specifiedFromBlock = 0
      specifiedLoggedToBlock = 0
      await eventWatcher.poll(0, 5, () => {})
      expect(specifiedToBlock).toBe(5)
      expect(specifiedFromBlock).toBe(0)
      expect(specifiedLoggedToBlock).toBe(5)
    })
    test('When the approval option is specified, the fromBlock option is set to the current block number minus the value of approval..', async () => {
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
      specifiedFromBlock = 0
      specifiedLoggedToBlock = 0
      await eventWatcher.poll(5, 10, () => {})
      expect(specifiedToBlock).toBe(10)
      expect(specifiedFromBlock).toBe(2)
      expect(specifiedLoggedToBlock).toBe(10)
    })
    test('When the approval option is not specified, the fromBlock option is set to the specified block number', async () => {
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
      specifiedFromBlock = 0
      specifiedLoggedToBlock = 0
      await eventWatcher.poll(5, 10, () => {})
      expect(specifiedToBlock).toBe(10)
      expect(specifiedFromBlock).toBe(5)
      expect(specifiedLoggedToBlock).toBe(10)
    })
  })
})
