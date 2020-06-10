import {
  CompiledPredicate,
  CompiledDecider,
  Property,
  DeciderManager,
  FreeVariable,
  AtomicPredicate,
  LogicalConnective,
  PredicateLabel
} from '../../src'
import { Address, Bytes } from '@cryptoeconomicslab/primitives'
import { initializeDeciderManager } from '../helpers/initiateDeciderManager'
import Coder from '@cryptoeconomicslab/coder'
import { setupContext } from '@cryptoeconomicslab/context'
import { Secp256k1Signer } from '@cryptoeconomicslab/signature'
import { Wallet } from 'ethers'
import { putWitness, replaceHint } from '@cryptoeconomicslab/db'
import { OWNERSHIP_SOURCE } from './TestSource'
setupContext({ coder: Coder })

const MESSAGE = Bytes.fromString('message')
const SECP256K1 = Bytes.fromHexString('0x736563703235366b31')

describe('OwnershipProperty', () => {
  let wallet: Wallet,
    aliceAddress: Address,
    signer: Secp256k1Signer,
    predicateAddress: Address,
    compiledPredicate: CompiledPredicate,
    compiledDecider: CompiledDecider,
    deciderManager: DeciderManager

  beforeAll(() => {
    wallet = new Wallet(
      '0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3'
    )
    aliceAddress = Address.from(wallet.address)
    signer = new Secp256k1Signer(Bytes.fromHexString(wallet.privateKey))
    predicateAddress = Address.from(
      '0x0250035000301010002000900380005700060001'
    )
    compiledPredicate = CompiledPredicate.fromSource(
      predicateAddress,
      OWNERSHIP_SOURCE
    )
    compiledDecider = new CompiledDecider(compiledPredicate, {
      secp256k1: SECP256K1
    })
  })

  beforeEach(() => {
    deciderManager = initializeDeciderManager()
  })

  test('ownership decides to true', async () => {
    deciderManager.setDecider(predicateAddress, compiledDecider)
    const property = new Property(predicateAddress, [
      PredicateLabel.from('OwnershipT'),
      Coder.encode(aliceAddress),
      MESSAGE
    ])
    const signature = await signer.sign(MESSAGE)
    await putWitness(
      deciderManager.witnessDb,
      replaceHint('signatures,KEY,${m}', { m: MESSAGE }),
      signature
    )
    const decision = await compiledDecider.decide(
      deciderManager,
      property.inputs,
      {}
    )

    expect(decision).toStrictEqual({
      witnesses: [signature],
      challenge: null,
      outcome: true
    })
  })

  test('ownership decides to false and challenge inputs is correct', async () => {
    deciderManager.setDecider(predicateAddress, compiledDecider)
    const property = new Property(predicateAddress, [
      PredicateLabel.from('OwnershipT'),
      Coder.encode(aliceAddress),
      MESSAGE
    ])

    const decision = await compiledDecider.decide(
      deciderManager,
      property.inputs,
      {}
    )

    const challengeProperty = new Property(
      deciderManager.getDeciderAddress(LogicalConnective.ForAllSuchThat),
      [
        Bytes.fromString(''),
        Bytes.fromString('v0'),
        Coder.encode(
          new Property(
            deciderManager.getDeciderAddress(LogicalConnective.Not),
            [
              Coder.encode(
                new Property(
                  deciderManager.getDeciderAddress(
                    AtomicPredicate.IsValidSignature
                  ),
                  [
                    MESSAGE,
                    FreeVariable.from('v0'),
                    Coder.encode(aliceAddress),
                    SECP256K1
                  ]
                ).toStruct()
              )
            ]
          ).toStruct()
        )
      ]
    )

    expect(decision.outcome).toBe(false)
    expect(decision.challenge).toStrictEqual({
      challengeInputs: [],
      property: challengeProperty
    })
  })
})
