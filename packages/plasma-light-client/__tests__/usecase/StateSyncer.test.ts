import { StateSyncer } from '../../src/usecase/StateSyncer'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import { InMemoryKeyValueStore } from '@cryptoeconomicslab/level-kvs'
import { setupContext } from '@cryptoeconomicslab/context'
import JsonCoder from '@cryptoeconomicslab/coder'
import {
  Address,
  BigNumber,
  Bytes,
  FixedBytes,
  Property,
  Range
} from '@cryptoeconomicslab/primitives'
import { EventEmitter } from 'events'
import { StateUpdate, IncludedTransaction } from '@cryptoeconomicslab/plasma'
import {
  CheckpointRepository,
  StateUpdateRepository
} from '../../src/repository'
import {
  DoubleLayerTreeGenerator,
  DoubleLayerTreeLeaf
} from '@cryptoeconomicslab/merkle-tree'
import { Keccak256 } from '../../../ovm/node_modules/@cryptoeconomicslab/hash/lib'
setupContext({ coder: JsonCoder })

const commitmentVerifierAddress = Address.default()
const checkpointAddress = Address.default()
const depositContractAddress = Address.default()
const tokenAddress = Address.default()
const stateUpdateAddress = Address.default()
const stateUpdate = su(0, 100)
const remainStateUpdate = su(50, 100)
const alice = Address.default()
const bob = Address.default()
const transaction = createTransaction(0, 50, 5, alice, bob)

function su(start: number, end: number): StateUpdate {
  return createStateUpdate(start, end, 1, Address.default())
}

function createTransaction(
  start: number,
  end: number,
  blockNumber: number,
  owner: Address,
  from: Address
): IncludedTransaction {
  return new IncludedTransaction(
    depositContractAddress,
    new Range(BigNumber.from(start), BigNumber.from(end)),
    BigNumber.from(blockNumber),
    new Property(Address.default(), [ovmContext.coder.encode(owner)]),
    from,
    Bytes.default(),
    BigNumber.from(blockNumber)
  )
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
    new Property(Address.default(), [ovmContext.coder.encode(owner)])
  )
}

function createLeaf(su: StateUpdate) {
  return new DoubleLayerTreeLeaf(
    su.depositContractAddress,
    su.range.start,
    FixedBytes.from(
      32,
      Keccak256.hash(ovmContext.coder.encode(su.stateObject.toStruct())).data
    )
  )
}

const generator = new DoubleLayerTreeGenerator()
const merkleTree = generator.generate([
  createLeaf(stateUpdate),
  createLeaf(createStateUpdate(100, 120, 1, Address.default())),
  createLeaf(createStateUpdate(120, 150, 1, Address.default())),
  createLeaf(createStateUpdate(200, 201, 1, Address.default()))
])

// mock APIClient
const MockApiClient = jest
  .fn()
  .mockImplementation((latestStateUpdates: StateUpdate[]) => {
    return {
      syncState: jest.fn().mockResolvedValue({
        data: latestStateUpdates.map(su =>
          ovmContext.coder.encode(su.toStruct()).toHexString()
        )
      }),
      spentProof: jest.fn().mockResolvedValue({
        data: {
          data: [ovmContext.coder.encode(transaction.toStruct()).toHexString()]
        }
      }),
      inclusionProof: jest.fn().mockResolvedValue({
        data: {
          data: ovmContext.coder
            .encode(
              merkleTree
                .getInclusionProofByAddressAndIndex(depositContractAddress, 0)
                .toStruct()
            )
            .toHexString()
        }
      }),
      checkpointWitness: jest.fn().mockResolvedValue({
        data: {
          data: []
        }
      }),

      sendTransaction: jest.fn()
    }
  })

const MockCommitmentContract = jest
  .fn()
  .mockImplementation((addr: Address, eventDb: KeyValueStore) => ({
    submitRoot: () => undefined,
    getCurrentBlock: jest.fn().mockResolvedValue(BigNumber.from(1)),
    getRoot: jest.fn().mockResolvedValue(FixedBytes.default(32))
  }))

const MockCompiledPredicate = jest
  .fn()
  .mockImplementation((addr: Address, eventDb: KeyValueStore) => ({
    makeProperty: jest
      .fn()
      .mockImplementation(
        (inputs: Bytes[]) => new Property(checkpointAddress, inputs)
      )
  }))
const compiledPredicateMap = new Map()
compiledPredicateMap.set('Checkpoint', new MockCompiledPredicate())

const MockDeciderManager = jest
  .fn()
  .mockImplementation((addr: Address, eventDb: KeyValueStore) => ({
    compiledPredicateMap: compiledPredicateMap,
    decide: jest.fn().mockResolvedValue({ outcome: true })
  }))

const MockTokenManager = jest
  .fn()
  .mockImplementation((addr: Address, eventDb: KeyValueStore) => ({
    depositContractAddresses: [depositContractAddress],
    getTokenContractAddress: jest.fn().mockReturnValue(tokenAddress.data),
    getCurrentBlock: jest.fn().mockResolvedValue(BigNumber.from(1))
  }))

const MockCheckpointDispute = jest.fn().mockImplementation(() => ({}))

describe('StateSyncer', () => {
  beforeEach(async () => {})

  test('sync latest checkpoint state 0-100', async () => {
    const witnessDb = new InMemoryKeyValueStore(Bytes.default())
    const checkpointRepository = await CheckpointRepository.init(witnessDb)
    await checkpointRepository.insertSettledCheckpoint(stateUpdate)
    const stateSyncer = new StateSyncer(
      new EventEmitter(),
      witnessDb,
      new MockCommitmentContract(),
      commitmentVerifierAddress,
      new MockApiClient([stateUpdate]),
      new MockTokenManager(),
      new MockDeciderManager(),
      new MockCheckpointDispute()
    )
    await stateSyncer.syncLatest(BigNumber.from(10), Address.default())
    const stateUpdateRepository = await StateUpdateRepository.init(witnessDb)
    const results = await stateUpdateRepository.getVerifiedStateUpdates(
      depositContractAddress,
      new Range(BigNumber.from(0), BigNumber.MAX_NUMBER)
    )
    expect(results).toEqual([stateUpdate])
  })

  test('sync latest state update 0-100', async () => {
    const witnessDb = new InMemoryKeyValueStore(Bytes.default())
    const stateSyncer = new StateSyncer(
      new EventEmitter(),
      witnessDb,
      new MockCommitmentContract(),
      commitmentVerifierAddress,
      new MockApiClient([stateUpdate]),
      new MockTokenManager(),
      new MockDeciderManager(),
      new MockCheckpointDispute()
    )
    await stateSyncer.syncLatest(BigNumber.from(10), Address.default())
    const stateUpdateRepository = await StateUpdateRepository.init(witnessDb)
    const results = await stateUpdateRepository.getVerifiedStateUpdates(
      depositContractAddress,
      new Range(BigNumber.from(0), BigNumber.MAX_NUMBER)
    )
    expect(results).toEqual([stateUpdate])
  })

  test('sync spent proof and latest state is 50-100', async () => {
    const witnessDb = new InMemoryKeyValueStore(Bytes.default())
    const stateUpdateRepository = await StateUpdateRepository.init(witnessDb)
    await stateUpdateRepository.insertVerifiedStateUpdate(stateUpdate)
    const stateSyncer = new StateSyncer(
      new EventEmitter(),
      witnessDb,
      new MockCommitmentContract(),
      commitmentVerifierAddress,
      new MockApiClient([]),
      new MockTokenManager(),
      new MockDeciderManager(),
      new MockCheckpointDispute()
    )
    await stateSyncer.syncLatest(BigNumber.from(10), Address.default())
    const results = await stateUpdateRepository.getVerifiedStateUpdates(
      depositContractAddress,
      new Range(BigNumber.from(0), BigNumber.MAX_NUMBER)
    )
    expect(results).toEqual([remainStateUpdate])
  })
})
