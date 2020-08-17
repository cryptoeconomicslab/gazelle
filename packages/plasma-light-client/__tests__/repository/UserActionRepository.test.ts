import { UserActionRepository } from '../../src/repository'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import { IndexedDbKeyValueStore } from '@cryptoeconomicslab/indexeddb-kvs'
import {
  Address,
  Bytes,
  BigNumber,
  Range
} from '@cryptoeconomicslab/primitives'
import { setupContext } from '@cryptoeconomicslab/context'
import { EthCoder } from '@cryptoeconomicslab/eth-coder'
import 'fake-indexeddb/auto'
import {
  createSendUserAction,
  createDepositUserAction,
  ActionType
} from '../../src/UserAction'
setupContext({ coder: EthCoder })

const tokenAddress = Address.default()
const range = new Range(BigNumber.from(0), BigNumber.from(10))

describe('UserActionRepository', () => {
  let repository: UserActionRepository, db: KeyValueStore

  beforeEach(async () => {
    db = new IndexedDbKeyValueStore(Bytes.fromString('sync'))
    repository = await UserActionRepository.init(db)
  })

  test('insert and get', async () => {
    const blockNumber = BigNumber.from(1)
    const action = createSendUserAction(
      tokenAddress,
      range,
      Address.default(),
      blockNumber,
      Bytes.default()
    )

    await repository.insertAction(blockNumber, range, action)

    const result = await repository.getUserActions(blockNumber)
    expect(result.length).toBe(1)
    expect(result[0].type).toBe(ActionType.Send)
  })

  test('getUntil', async () => {
    const blockNumber = BigNumber.from(1)
    const blockNumber2 = BigNumber.from(5)

    const action = createDepositUserAction(
      tokenAddress,
      range,
      blockNumber,
      Bytes.default()
    )
    const action2 = createSendUserAction(
      tokenAddress,
      range,
      Address.default(),
      blockNumber2,
      Bytes.default()
    )

    await repository.insertAction(blockNumber, range, action)
    await repository.insertAction(blockNumber2, range, action2)

    const result = await repository.getAllUserActionsUntilBlock(
      BigNumber.from(10)
    )
    expect(result.length).toEqual(2)
    expect(result[0].type).toEqual(ActionType.Deposit)
    expect(result[1].type).toEqual(ActionType.Send)
  })
})
