import { TransferUsecase } from '../../src/usecase/TransferUsecase'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import { InMemoryKeyValueStore } from '@cryptoeconomicslab/level-kvs'
import { setupContext } from '@cryptoeconomicslab/context'
import JsonCoder from '@cryptoeconomicslab/coder'
import {
  Address,
  BigNumber,
  Bytes,
  Property,
  Range
} from '@cryptoeconomicslab/primitives'
import {
  StateUpdate,
  SignedTransaction,
  UnsignedTransaction
} from '@cryptoeconomicslab/plasma'
import { generateRandomWallet } from '../helper/MockWallet'
import { prepareSU } from '../helper/prepare'
import { Wallet } from '@cryptoeconomicslab/wallet'
setupContext({ coder: JsonCoder })

const depositContractAddress = Address.default()
const tokenAddress = Address.default()
const stateUpdate1 = su(100, 200)
const stateUpdate2 = su(200, 300)
const stateUpdate3 = su(300, 400)

function su(start: number, end: number): StateUpdate {
  return createStateUpdate(start, end, 1, Address.default())
}

async function prepareTransaction(
  start: number,
  end: number,
  blockNumber: number,
  owner: Address,
  from: Address,
  wallet: Wallet
): Promise<SignedTransaction> {
  const tx = new UnsignedTransaction(
    depositContractAddress,
    new Range(BigNumber.from(start), BigNumber.from(end)),
    BigNumber.from(blockNumber),
    new Property(Address.default(), [ovmContext.coder.encode(owner)]),
    from
  )
  return await tx.sign(wallet)
}

function createStateUpdate(
  start: number,
  end: number,
  blockNumber: number,
  owner: Address
): StateUpdate {
  return new StateUpdate(
    depositContractAddress,
    new Range(BigNumber.from(start), BigNumber.from(end)),
    BigNumber.from(blockNumber),
    createStateObject(owner)
  )
}

function createStateObject(owner: Address) {
  return new Property(Address.default(), [ovmContext.coder.encode(owner)])
}

// mock APIClient
const mockSendTransaction = jest.fn()
const MockApiClient = jest.fn().mockImplementation(() => {
  return {
    sendTransaction: mockSendTransaction.mockResolvedValue({ data: [] })
  }
})

const MockTokenManager = jest
  .fn()
  .mockImplementation((addr: Address, eventDb: KeyValueStore) => ({
    getDepositContractAddress: jest
      .fn()
      .mockReturnValue(depositContractAddress.data)
  }))

const ALICE = generateRandomWallet()
const BOB = generateRandomWallet()
describe('TransferUsecase', () => {
  beforeEach(async () => {
    mockSendTransaction.mockClear()
  })

  test('send transaction 200 with 100-200, 200-300', async () => {
    const witnessDb = new InMemoryKeyValueStore(Bytes.default())
    await prepareSU(witnessDb, stateUpdate1)
    await prepareSU(witnessDb, stateUpdate2)
    const transferUsercase = new TransferUsecase(
      witnessDb,
      ALICE,
      new MockApiClient(),
      new MockTokenManager()
    )
    await transferUsercase.sendTransaction(
      200,
      tokenAddress.data,
      createStateObject(BOB.getAddress())
    )
    const expectedTx = await prepareTransaction(
      100,
      300,
      5,
      BOB.getAddress(),
      ALICE.getAddress(),
      ALICE
    )
    expect(mockSendTransaction).toHaveBeenCalledWith([expectedTx])
  })

  test('send transaction 150 with 100-200, 200-300', async () => {
    const witnessDb = new InMemoryKeyValueStore(Bytes.default())
    await prepareSU(witnessDb, stateUpdate1)
    await prepareSU(witnessDb, stateUpdate2)
    const transferUsercase = new TransferUsecase(
      witnessDb,
      ALICE,
      new MockApiClient(),
      new MockTokenManager()
    )
    await transferUsercase.sendTransaction(
      150,
      tokenAddress.data,
      createStateObject(BOB.getAddress())
    )
    const expectedTx = await prepareTransaction(
      100,
      250,
      5,
      BOB.getAddress(),
      ALICE.getAddress(),
      ALICE
    )
    expect(mockSendTransaction).toHaveBeenCalledWith([expectedTx])
  })

  test('send transaction 250 with 100-200, 200-300, 300-400', async () => {
    const witnessDb = new InMemoryKeyValueStore(Bytes.default())
    await prepareSU(witnessDb, stateUpdate1)
    await prepareSU(witnessDb, stateUpdate2)
    await prepareSU(witnessDb, stateUpdate3)
    const transferUsercase = new TransferUsecase(
      witnessDb,
      ALICE,
      new MockApiClient(),
      new MockTokenManager()
    )
    await transferUsercase.sendTransaction(
      250,
      tokenAddress.data,
      createStateObject(BOB.getAddress())
    )
    const expectedTx = await prepareTransaction(
      100,
      350,
      5,
      BOB.getAddress(),
      ALICE.getAddress(),
      ALICE
    )
    expect(mockSendTransaction).toHaveBeenCalledWith([expectedTx])
  })

  test('send transaction 150 with 100-200, 300-400', async () => {
    const witnessDb = new InMemoryKeyValueStore(Bytes.default())
    await prepareSU(witnessDb, stateUpdate1)
    await prepareSU(witnessDb, stateUpdate3)
    const transferUsercase = new TransferUsecase(
      witnessDb,
      ALICE,
      new MockApiClient(),
      new MockTokenManager()
    )
    await transferUsercase.sendTransaction(
      150,
      tokenAddress.data,
      createStateObject(BOB.getAddress())
    )
    const expectedTx1 = await prepareTransaction(
      100,
      200,
      5,
      BOB.getAddress(),
      ALICE.getAddress(),
      ALICE
    )
    const expectedTx2 = await prepareTransaction(
      300,
      350,
      5,
      BOB.getAddress(),
      ALICE.getAddress(),
      ALICE
    )
    expect(mockSendTransaction).toHaveBeenCalledWith([expectedTx1, expectedTx2])
  })
})
