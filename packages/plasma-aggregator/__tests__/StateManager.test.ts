import { StateManager } from '../src/managers'
import { RangeDb } from '@cryptoeconomicslab/db'
import { InMemoryKeyValueStore } from '@cryptoeconomicslab/level-kvs'
import {
  Bytes,
  Address,
  BigNumber,
  Range
} from '@cryptoeconomicslab/primitives'
import {
  DepositTransaction,
  StateUpdate,
  UnsignedTransaction
} from '@cryptoeconomicslab/plasma'
import {
  DeciderManager,
  CompiledPredicate,
  DeciderConfig
} from '@cryptoeconomicslab/ovm'
import { Balance } from '@cryptoeconomicslab/wallet'
import { EthCoder as Coder } from '@cryptoeconomicslab/eth-coder'
import {
  Secp256k1Signer,
  secp256k1Verifier
} from '@cryptoeconomicslab/signature'
import { setupContext } from '@cryptoeconomicslab/context'
import config from './config.local'
import { ethers } from 'ethers'
setupContext({ coder: Coder })

// mock wallet
const MockWallet = jest.fn().mockImplementation(() => {
  const w = ethers.Wallet.createRandom()
  const signingKey = new ethers.utils.SigningKey(w.privateKey)
  const address = w.address

  return {
    getAddress: () => Address.from(address),
    getL1Balance: async (tokenAddress?: Address) => {
      return new Balance(BigNumber.from(0), 18, 'eth')
    },
    signMessage: async (message: Bytes) => {
      const signer = new Secp256k1Signer(
        Bytes.fromHexString(signingKey.privateKey)
      )
      return signer.sign(message)
    },
    verifyMySignature: async (message: Bytes, signature: Bytes) => {
      const publicKey = Bytes.fromHexString(address)
      return await secp256k1Verifier.verify(message, signature, publicKey)
    }
  }
})

const DEPOSIT_ADDRESS = Address.default()
const ALIS_WALLET = new MockWallet()
const BOB_WALLET = new MockWallet()
const ALIS_ADDRESS = ALIS_WALLET.getAddress()
const BOB_ADDRESS = BOB_WALLET.getAddress()

describe('StateManager', () => {
  let stateManager: StateManager
  let deciderManager: DeciderManager
  let ownershipPredicate: CompiledPredicate

  function ownershipStateUpdate(
    address: Address,
    range: Range,
    blockNumber: BigNumber
  ) {
    return new StateUpdate(
      DEPOSIT_ADDRESS,
      range,
      blockNumber,
      ownershipPredicate.makeProperty([Coder.encode(address)])
    )
  }

  function depositTx(address: Address, range: Range, blockNumber: BigNumber) {
    const stateUpdate = ownershipStateUpdate(address, range, blockNumber)
    return new DepositTransaction(DEPOSIT_ADDRESS, stateUpdate)
  }

  beforeEach(async () => {
    const kvs = new InMemoryKeyValueStore(Bytes.fromString('test'))
    const witnessDb = await kvs.bucket(Bytes.fromString('witness'))
    deciderManager = new DeciderManager(witnessDb, Coder)
    deciderManager.loadJson(config as DeciderConfig)
    ownershipPredicate = deciderManager.compiledPredicateMap.get(
      'Ownership'
    ) as CompiledPredicate
    const rangeDb = new RangeDb(kvs)
    stateManager = new StateManager(rangeDb)
  })

  describe('insert deposit range, resolve state updates', () => {
    test('insert deposit range', async () => {
      const tx = depositTx(
        ALIS_ADDRESS,
        new Range(BigNumber.from(0), BigNumber.from(1)),
        BigNumber.from(0)
      )
      await expect(
        stateManager.insertDepositRange(tx, BigNumber.from(0))
      ).resolves.toBeUndefined()
    })

    test('resolve deposited range', async () => {
      const tx = depositTx(
        ALIS_ADDRESS,
        new Range(BigNumber.from(0), BigNumber.from(1)),
        BigNumber.from(0)
      )
      await stateManager.insertDepositRange(tx, BigNumber.from(0))
      const stateUpdates = await stateManager.resolveStateUpdates(
        tx.depositContractAddress,
        BigNumber.from(0),
        BigNumber.from(1)
      )
      expect(stateUpdates).toEqual([
        ownershipStateUpdate(
          ALIS_ADDRESS,
          new Range(BigNumber.from(0), BigNumber.from(1)),
          BigNumber.from(0)
        )
      ])
    })

    test('resolve state update at block', async () => {
      const tx = depositTx(
        ALIS_ADDRESS,
        new Range(BigNumber.from(0), BigNumber.from(1)),
        BigNumber.from(0)
      )
      await stateManager.insertDepositRange(tx, BigNumber.from(0))
      await stateManager.insertDepositRange(tx, BigNumber.from(1))
      const stateUpdates = await stateManager.resolveStateUpdatesAtBlock(
        tx.depositContractAddress,
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(1)
      )
      expect(stateUpdates).toEqual([
        ownershipStateUpdate(
          ALIS_ADDRESS,
          new Range(BigNumber.from(0), BigNumber.from(1)),
          BigNumber.from(0)
        )
      ])
    })
  })

  describe('execute state transition', () => {
    beforeEach(async () => {
      await stateManager.insertDepositRange(
        depositTx(
          ALIS_ADDRESS,
          new Range(BigNumber.from(0), BigNumber.from(5)),
          BigNumber.from(0)
        ),
        BigNumber.from(0)
      )
      await stateManager.insertDepositRange(
        depositTx(
          ALIS_ADDRESS,
          new Range(BigNumber.from(5), BigNumber.from(10)),
          BigNumber.from(0)
        ),
        BigNumber.from(0)
      )
      await stateManager.insertDepositRange(
        depositTx(
          ALIS_ADDRESS,
          new Range(BigNumber.from(12), BigNumber.from(15)),
          BigNumber.from(0)
        ),
        BigNumber.from(0)
      )
    })

    test('succeed to update whole deposited range', async () => {
      const tx = new UnsignedTransaction(
        DEPOSIT_ADDRESS,
        new Range(BigNumber.from(0), BigNumber.from(5)),
        BigNumber.from(3),
        ownershipPredicate.makeProperty([Coder.encode(BOB_ADDRESS)]),
        ALIS_ADDRESS
      )
      const signedTx = await tx.sign(ALIS_WALLET)
      expect(
        await stateManager.executeStateTransition(
          signedTx,
          BigNumber.from(1),
          deciderManager
        )
      ).toEqual(
        ownershipStateUpdate(
          BOB_ADDRESS,
          new Range(BigNumber.from(0), BigNumber.from(5)),
          BigNumber.from(1)
        )
      )
    })

    test('succeed to update subrange of deposited range', async () => {
      const tx = new UnsignedTransaction(
        DEPOSIT_ADDRESS,
        new Range(BigNumber.from(0), BigNumber.from(3)),
        BigNumber.from(2),
        ownershipPredicate.makeProperty([Coder.encode(BOB_ADDRESS)]),
        ALIS_ADDRESS
      )
      const signedTx = await tx.sign(ALIS_WALLET)
      expect(
        await stateManager.executeStateTransition(
          signedTx,
          BigNumber.from(1),
          deciderManager
        )
      ).toEqual(
        ownershipStateUpdate(
          BOB_ADDRESS,
          new Range(BigNumber.from(0), BigNumber.from(3)),
          BigNumber.from(1)
        )
      )
    })

    test('succeed to update contigious multiple ranges', async () => {
      const tx = new UnsignedTransaction(
        DEPOSIT_ADDRESS,
        new Range(BigNumber.from(0), BigNumber.from(10)),
        BigNumber.from(2),
        ownershipPredicate.makeProperty([Coder.encode(BOB_ADDRESS)]),
        ALIS_ADDRESS
      )
      const signedTx = await tx.sign(ALIS_WALLET)
      expect(
        await stateManager.executeStateTransition(
          signedTx,
          BigNumber.from(1),
          deciderManager
        )
      ).toEqual(
        ownershipStateUpdate(
          BOB_ADDRESS,
          new Range(BigNumber.from(0), BigNumber.from(10)),
          BigNumber.from(1)
        )
      )
    })

    test('succeed to update intersected multiple ranges', async () => {
      const tx = new UnsignedTransaction(
        DEPOSIT_ADDRESS,
        new Range(BigNumber.from(2), BigNumber.from(7)),
        BigNumber.from(2),
        ownershipPredicate.makeProperty([Coder.encode(BOB_ADDRESS)]),
        ALIS_ADDRESS
      )
      const signedTx = await tx.sign(ALIS_WALLET)
      expect(
        await stateManager.executeStateTransition(
          signedTx,
          BigNumber.from(1),
          deciderManager
        )
      ).toEqual(
        ownershipStateUpdate(
          BOB_ADDRESS,
          new Range(BigNumber.from(2), BigNumber.from(7)),
          BigNumber.from(1)
        )
      )
    })

    test('fail to update with invalid transaction', async () => {
      const tx = new UnsignedTransaction(
        DEPOSIT_ADDRESS,
        new Range(BigNumber.from(0), BigNumber.from(3)),
        BigNumber.from(2),
        ownershipPredicate.makeProperty([Coder.encode(BOB_ADDRESS)]),
        ALIS_ADDRESS
      )
      const signedTx = await tx.sign(BOB_WALLET)
      await expect(
        stateManager.executeStateTransition(
          signedTx,
          BigNumber.from(1),
          deciderManager
        )
      ).rejects.toEqual(new Error('InvalidTransaction'))
    })

    test('fail to update with no intersected prevStates', async () => {
      const tx = new UnsignedTransaction(
        DEPOSIT_ADDRESS,
        new Range(BigNumber.from(20), BigNumber.from(25)),
        BigNumber.from(2),
        ownershipPredicate.makeProperty([Coder.encode(BOB_ADDRESS)]),
        ALIS_ADDRESS
      )
      const signedTx = await tx.sign(ALIS_WALLET)
      await expect(
        stateManager.executeStateTransition(
          signedTx,
          BigNumber.from(1),
          deciderManager
        )
      ).rejects.toEqual(new Error('InvalidTransaction'))
    })

    test('fail to update not contigious multiple ranges', async () => {
      const tx = new UnsignedTransaction(
        DEPOSIT_ADDRESS,
        new Range(BigNumber.from(0), BigNumber.from(15)),
        BigNumber.from(2),
        ownershipPredicate.makeProperty([Coder.encode(BOB_ADDRESS)]),
        ALIS_ADDRESS
      )
      const signedTx = await tx.sign(ALIS_WALLET)

      await expect(
        stateManager.executeStateTransition(
          signedTx,
          BigNumber.from(1),
          deciderManager
        )
      ).rejects.toEqual(new Error('InvalidTransaction'))
    })
  })

  describe('queryOwnershipStateUpdates', () => {
    test('simple get', async () => {
      await stateManager.insertDepositRange(
        depositTx(
          ALIS_ADDRESS,
          new Range(BigNumber.from(0), BigNumber.from(5)),
          BigNumber.from(0)
        ),
        BigNumber.from(0)
      )
      await stateManager.insertDepositRange(
        depositTx(
          BOB_ADDRESS,
          new Range(BigNumber.from(5), BigNumber.from(15)),
          BigNumber.from(0)
        ),
        BigNumber.from(0)
      )
      await stateManager.insertDepositRange(
        depositTx(
          ALIS_ADDRESS,
          new Range(BigNumber.from(15), BigNumber.from(20)),
          BigNumber.from(0)
        ),
        BigNumber.from(0)
      )
      const stateUpdates = await stateManager.queryOwnershipyStateUpdates(
        DEPOSIT_ADDRESS,
        ownershipPredicate.deployedAddress,
        ALIS_ADDRESS
      )

      expect(stateUpdates).toEqual([
        ownershipStateUpdate(
          ALIS_ADDRESS,
          new Range(BigNumber.from(0), BigNumber.from(5)),
          BigNumber.from(0)
        ),
        ownershipStateUpdate(
          ALIS_ADDRESS,
          new Range(BigNumber.from(15), BigNumber.from(20)),
          BigNumber.from(0)
        )
      ])
    })

    test('with deposit address', async () => {
      await stateManager.insertDepositRange(
        depositTx(
          ALIS_ADDRESS,
          new Range(BigNumber.from(0), BigNumber.from(5)),
          BigNumber.from(0)
        ),
        BigNumber.from(0)
      )

      const stateUpdates = await stateManager.queryOwnershipyStateUpdates(
        DEPOSIT_ADDRESS,
        Address.default(),
        ALIS_ADDRESS
      )
      expect(stateUpdates).toEqual([])
    })
  })
})
