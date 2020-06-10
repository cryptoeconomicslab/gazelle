import { Wallet } from 'ethers'
import {
  Address,
  Range,
  BigNumber,
  Bytes,
  FixedBytes
} from '@cryptoeconomicslab/primitives'
import { EthCoder as Coder } from '@cryptoeconomicslab/eth-coder'
import { Secp256k1Signer } from '@cryptoeconomicslab/signature'
import { setupContext } from '@cryptoeconomicslab/context'
import {
  initializeDeciderManager,
  SampleDeciderAddress,
  NotDeciderAddress,
  ForAllSuchThatDeciderAddress
} from '../helpers/initiateDeciderManager'
import {
  Property,
  CompiledDecider,
  CompiledPredicate,
  DeciderManager,
  FreeVariable,
  PredicateLabel
} from '../../src'
import { putWitness, replaceHint } from '@cryptoeconomicslab/db'
import {
  DoubleLayerTreeGenerator,
  DoubleLayerTreeLeaf
} from '@cryptoeconomicslab/merkle-tree'
import { Keccak256 } from '@cryptoeconomicslab/hash'
import { decodeStructable } from '@cryptoeconomicslab/coder'
import {
  OWNERSHIP_SOURCE,
  STATEUPDATE_SOURCE,
  EXIT_SOURCE,
  CHECKPOINT_SOURCE
} from './TestSource'
setupContext({ coder: Coder })

const commitmentContractAddress = Address.from(
  '0x4444444444444444444444444444444444444444'
)
const txAddress = Address.from('0x7777777777777777777777777777777777777777')

// setup deciders
const stateUpdateAddress = Address.from(
  '0x0250035000301010002000900380005700060000'
)
const stateUpdatePredicate = CompiledPredicate.fromSource(
  stateUpdateAddress,
  STATEUPDATE_SOURCE
)
const stateUpdateDecider = new CompiledDecider(stateUpdatePredicate, {
  txAddress: Coder.encode(txAddress)
})

const checkpointAddress = Address.from(
  '0x02500350003010100e2b00900380005700060002'
)
const checkpointPredicate = CompiledPredicate.fromSource(
  checkpointAddress,
  CHECKPOINT_SOURCE
)
const checkpointDecider = new CompiledDecider(checkpointPredicate, {
  commitmentContract: Coder.encode(commitmentContractAddress)
})

const exitAddress = Address.from('0x0250035000301010002000900380005700060001')
const exitPredicate = CompiledPredicate.fromSource(exitAddress, EXIT_SOURCE)
const exitDecider = new CompiledDecider(exitPredicate, {
  commitmentContract: Coder.encode(commitmentContractAddress)
})

const SECP256K1 = Bytes.fromHexString('0x736563703235366b31')

const ownershipAddress = Address.from(
  '0x0000000000000000000000000000000000011111'
)
const ownershipPredicate = CompiledPredicate.fromSource(
  ownershipAddress,
  OWNERSHIP_SOURCE
)
const ownershipDecider = new CompiledDecider(ownershipPredicate, {
  secp256k1: SECP256K1
})

const tokenAddress = Address.from('0x0000000000000000000000888880000000000000')

// helper functions

// create stateUpdate property
function createSU(
  start: number,
  end: number,
  blockNumber: number,
  owner: Address,
  alwaysTrue?: boolean
): Property {
  return new Property(stateUpdateAddress, [
    Coder.encode(tokenAddress),
    Coder.encode(
      new Range(BigNumber.from(start), BigNumber.from(end)).toStruct()
    ),
    Coder.encode(BigNumber.from(blockNumber)),
    Coder.encode(
      alwaysTrue
        ? new Property(SampleDeciderAddress, [
            Bytes.fromHexString('0x01')
          ]).toStruct()
        : ownershipPredicate.makeProperty([Coder.encode(owner)]).toStruct()
    )
  ])
}

// get block number from state update property
function getBlockNumber(su: Property) {
  return Coder.decode(BigNumber.default(), su.inputs[2])
}
// get range from state update property
function getRange(su: Property) {
  return decodeStructable(Range, Coder, su.inputs[1])
}
// get deposit contract address from state update property
function getDepositContractAddress(su: Property) {
  return Coder.decode(Address.default(), su.inputs[0])
}

// create double layer leaf from state update property
function createLeaf(su: Property) {
  const depositContractAddress = Coder.decode(Address.default(), su.inputs[0])
  const start = decodeStructable(Range, Coder, su.inputs[1]).start
  return new DoubleLayerTreeLeaf(
    depositContractAddress,
    start,
    FixedBytes.from(32, Keccak256.hash(su.inputs[3]).data)
  )
}

describe('Exit', () => {
  let deciderManager: DeciderManager
  const wallet = new Wallet(
    '0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3'
  )
  const aliceAddress = Address.from(wallet.address)
  const aliceSU = createSU(0, 10, 1, aliceAddress)
  const signer = new Secp256k1Signer(Bytes.fromHexString(wallet.privateKey))

  const bobAddress = Address.from('0x4444444444444444455555555555555554444444')
  const bobSU = createSU(0, 10, 2, bobAddress, true)

  const generator = new DoubleLayerTreeGenerator()
  const merkleTree1 = generator.generate([
    createLeaf(aliceSU),
    createLeaf(createSU(20, 30, 1, Address.default())),
    createLeaf(createSU(100, 120, 1, Address.default())),
    createLeaf(createSU(200, 201, 1, Address.default()))
  ])
  const merkleTree2 = generator.generate([
    createLeaf(bobSU),
    createLeaf(createSU(20, 30, 1, Address.default())),
    createLeaf(createSU(200, 201, 1, Address.default()))
  ])

  const root1 = merkleTree1.getRoot()
  const inclusionProof1 = merkleTree1.getInclusionProofByAddressAndIndex(
    tokenAddress,
    0
  )
  const root2 = merkleTree2.getRoot()
  const inclusionProof2 = merkleTree2.getInclusionProofByAddressAndIndex(
    tokenAddress,
    0
  )

  // store state update witness for SU quantifier
  // alice owns su at block 1
  async function prepareSuWitness() {
    const suHint = replaceHint('su.block${b}.range${token},RANGE,${range}', {
      b: Coder.encode(getBlockNumber(aliceSU)),
      token: Coder.encode(getDepositContractAddress(aliceSU)),
      range: Coder.encode(getRange(aliceSU).toStruct())
    })
    await putWitness(
      deciderManager.witnessDb,
      suHint,
      Coder.encode(aliceSU.toStruct())
    )
  }

  // store inclusion proof witness for IncludedAt quantifier
  // at block 1, alice owns the range and send it to bob.
  // inclusion proof of alice's su is stored at block 1
  async function prepareProofWitness() {
    const proofHint = replaceHint(
      'proof.block${b}.range${token},RANGE,${range}',
      {
        b: Coder.encode(getBlockNumber(aliceSU)),
        token: Coder.encode(getDepositContractAddress(aliceSU)),
        range: Coder.encode(getRange(aliceSU).toStruct())
      }
    )
    await putWitness(
      deciderManager.witnessDb,
      proofHint,
      Coder.encode(inclusionProof1.toStruct())
    )
  }

  // store tx witness for StateUpdate decider
  // alice sends the range to bob at block 2
  async function prepareTxWitness() {
    const txProperty = new Property(txAddress, [
      Coder.encode(tokenAddress),
      Coder.encode(new Range(BigNumber.from(0), BigNumber.from(10)).toStruct()),
      Coder.encode(BigNumber.from(5)),
      Coder.encode(
        ownershipPredicate.makeProperty([Coder.encode(bobAddress)]).toStruct()
      )
    ])
    await putWitness(
      deciderManager.witnessDb,
      replaceHint('tx.block${b}.range${token},RANGE,${range}', {
        b: Coder.encode(getBlockNumber(aliceSU)),
        token: Coder.encode(tokenAddress),
        range: Coder.encode(getRange(aliceSU).toStruct())
      }),
      Coder.encode(txProperty.toStruct())
    )
  }

  async function prepareTxForBobWitness() {
    const txProperty = new Property(txAddress, [
      Coder.encode(tokenAddress),
      Coder.encode(new Range(BigNumber.from(0), BigNumber.from(10)).toStruct()),
      Coder.encode(BigNumber.from(5)),
      Coder.encode(
        ownershipPredicate.makeProperty([Coder.encode(aliceAddress)]).toStruct()
      )
    ])
    await putWitness(
      deciderManager.witnessDb,
      replaceHint('tx.block${b}.range${token},RANGE,${range}', {
        b: Coder.encode(getBlockNumber(bobSU)),
        token: Coder.encode(tokenAddress),
        range: Coder.encode(getRange(bobSU).toStruct())
      }),
      Coder.encode(txProperty.toStruct())
    )
  }

  // store signature for ownership decider
  async function prepareSignatureWitness() {
    const txProperty = new Property(txAddress, [
      Coder.encode(tokenAddress),
      Coder.encode(new Range(BigNumber.from(0), BigNumber.from(10)).toStruct()),
      Coder.encode(BigNumber.from(5)),
      Coder.encode(
        ownershipPredicate.makeProperty([Coder.encode(bobAddress)]).toStruct()
      )
    ])
    const txBody = Coder.encode(txProperty.toStruct())
    const sig = await signer.sign(txBody)
    await putWitness(
      deciderManager.witnessDb,
      replaceHint('signatures,KEY,${m}', { m: txBody }),
      sig
    )
  }

  // store root hash for Stored.IncludedAt
  async function prepareRootWitness() {
    const rootHint = replaceHint('stored.${contract},KEY,${key}', {
      contract: Coder.encode(commitmentContractAddress),
      key: Coder.encode(BigNumber.from(1))
    })
    await putWitness(deciderManager.witnessDb, rootHint, Coder.encode(root1))

    const rootHint2 = replaceHint('stored.${contract},KEY,${key}', {
      contract: Coder.encode(commitmentContractAddress),
      key: Coder.encode(BigNumber.from(2))
    })
    await putWitness(deciderManager.witnessDb, rootHint2, Coder.encode(root2))

    const storageDb = await deciderManager.getStorageDb()
    const bucket = await storageDb.bucket(
      Coder.encode(commitmentContractAddress)
    )
    await bucket.put(Coder.encode(BigNumber.from(1)), Coder.encode(root1))
    await bucket.put(Coder.encode(BigNumber.from(2)), Coder.encode(root2))
  }

  beforeEach(() => {
    deciderManager = initializeDeciderManager()
    deciderManager.setDecider(ownershipAddress, ownershipDecider)
    deciderManager.setDecider(exitAddress, exitDecider)
    deciderManager.setDecider(stateUpdateAddress, stateUpdateDecider)
    deciderManager.setDecider(
      checkpointAddress,
      checkpointDecider,
      'Checkpoint'
    )
  })

  test('exit decides to true', async () => {
    // prepare witnesses
    await prepareSuWitness()
    await prepareProofWitness()
    await prepareTxWitness()
    await prepareSignatureWitness()
    await prepareRootWitness()

    const exitInputs = [
      PredicateLabel.from('ExitA'),
      Coder.encode(bobSU.toStruct()),
      Coder.encode(inclusionProof2.toStruct())
    ]

    const exitProperty = new Property(exitAddress, exitInputs)
    const decision = await exitDecider.decide(
      deciderManager,
      exitProperty.inputs
    )
    expect(decision.outcome).toBeTruthy()
  })

  test('exit decides false if su is true', async () => {
    // prepare witnesses
    await prepareSuWitness()
    await prepareProofWitness()
    await prepareTxWitness()
    await prepareSignatureWitness()
    await prepareRootWitness()
    await prepareTxForBobWitness()

    const exitInputs = [
      PredicateLabel.from('ExitA'),
      Coder.encode(bobSU.toStruct()),
      Coder.encode(inclusionProof2.toStruct())
    ]

    const exitProperty = new Property(exitAddress, exitInputs)
    const decision = await exitDecider.decide(
      deciderManager,
      exitProperty.inputs
    )

    expect(decision.outcome).toBeFalsy()
    expect(decision.challenge).toEqual({
      challengeInputs: [Coder.encode(BigNumber.from(0))],
      property: bobSU
    })
  })
  test('exit decides false if checkpoint is false', async () => {
    // prepare witnesses
    await prepareSuWitness()
    await prepareProofWitness()
    await prepareTxWitness()
    await prepareSignatureWitness()

    const exitInputs = [
      PredicateLabel.from('ExitA'),
      Coder.encode(bobSU.toStruct()),
      Coder.encode(inclusionProof2.toStruct())
    ]

    const exitProperty = new Property(exitAddress, exitInputs)
    const decision = await exitDecider.decide(
      deciderManager,
      exitProperty.inputs
    )

    const challengeProperty = new Property(ForAllSuchThatDeciderAddress, [
      Bytes.fromString(''),
      Bytes.fromString('root'),
      Coder.encode(
        new Property(NotDeciderAddress, [
          Coder.encode(
            new Property(checkpointAddress, [
              PredicateLabel.from('CheckpointA1TA'),
              Coder.encode(bobSU.toStruct()),
              FreeVariable.from('root'),
              Coder.encode(inclusionProof2.toStruct())
            ]).toStruct()
          )
        ]).toStruct()
      )
    ])

    expect(decision.outcome).toBeFalsy()
    expect(decision.challenge).toEqual({
      challengeInputs: [
        Coder.encode(BigNumber.from(1)),
        Coder.encode(BigNumber.from(0))
      ],
      property: challengeProperty
    })
  })
})
