import {
  DeciderManager,
  IsValidSignatureDecider,
  ForAllSuchThatDecider,
  LogicalConnective,
  createTypedParams
} from '../../src'
import {
  Address,
  BigNumber,
  Bytes,
  Property,
  Range,
  FixedBytes
} from '@cryptoeconomicslab/primitives'
import * as ethers from 'ethers'
import { Secp256k1Signer } from '@cryptoeconomicslab/signature'
import { InMemoryKeyValueStore } from '@cryptoeconomicslab/level-kvs'
import EthCoder from '@cryptoeconomicslab/eth-coder'
import { setupContext } from '@cryptoeconomicslab/context'
import { ForAllSuchThatDeciderAddress } from '../helpers/initiateDeciderManager'
import config from '../data/test.config'
import { UnsignedTransaction } from '@cryptoeconomicslab/plasma'
import { signTypedDataLegacy } from 'eth-sig-util'
import { arrayify } from 'ethers/utils'
setupContext({ coder: EthCoder })

describe('IsValidSignatureDecider', () => {
  const addr = Address.from('0x0000000000000000000000000000000000000001')
  const db = new InMemoryKeyValueStore(Bytes.fromString('test'))
  const deciderManager = new DeciderManager(db)
  deciderManager.loadJson(config)
  deciderManager.setDecider(
    ForAllSuchThatDeciderAddress,
    new ForAllSuchThatDecider(),
    LogicalConnective.ForAllSuchThat
  )
  deciderManager.setDecider(addr, new IsValidSignatureDecider())
  const wallet = ethers.Wallet.createRandom()
  let publicKey: string, privateKey: Bytes, message: Bytes, signature: Bytes

  beforeAll(async () => {
    publicKey = await wallet.getAddress()
    privateKey = Bytes.fromHexString(wallet.privateKey)
    message = Bytes.fromString('hello world')
    signature = await new Secp256k1Signer(privateKey).sign(message)
  })

  test('valid secp2561k signature', async () => {
    const property = new Property(addr, [
      message,
      signature,
      EthCoder.encode(Address.from(publicKey)),
      Bytes.fromString('secp256k1')
    ])

    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeTruthy()
  })

  test('invalid signature preimage', async () => {
    const property = new Property(addr, [
      message,
      Bytes.fromString('hellohello'),
      EthCoder.encode(Address.from(publicKey)),
      Bytes.fromString('secp256k1')
    ])

    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeFalsy()
  })

  test('invalid signature', async () => {
    const invalidSig = await new Secp256k1Signer(privateKey).sign(
      Bytes.fromString('invalid sig')
    )
    const property = new Property(addr, [
      message,
      invalidSig,
      EthCoder.encode(Address.from(publicKey)),
      Bytes.fromString('secp256k1')
    ])

    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeFalsy()
  })

  test('different signature algorithm', async () => {
    const property = new Property(addr, [
      message,
      signature,
      EthCoder.encode(Address.from(publicKey)),
      Bytes.fromString('ed25519')
    ])

    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeFalsy()
  })

  test('input tuple length is invalid', async () => {
    const property = new Property(addr, [message])

    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeFalsy()
  })

  test('typedData verifier type', async () => {
    const ownershipPredicateAddress = Address.from(
      '0x13274fe19c0178208bcbee397af8167a7be27f6f'
    )
    const owner = Address.from('0x4e71920b7330515faf5ea0c690f1ad06a85fb002')
    const depositContractAddress = Address.from(
      '0x4e71920b7330515faf5ea0c690f1ad06a85fb60c'
    )
    const range = new Range(
      BigNumber.fromString('0'),
      BigNumber.fromString('100000000000000000')
    )
    const stateObject = new Property(ownershipPredicateAddress, [
      ovmContext.coder.encode(owner)
    ])
    const tx = new UnsignedTransaction(
      depositContractAddress,
      range,
      BigNumber.from(0),
      stateObject,
      FixedBytes.default(32),
      Address.default()
    )
    const txBytes = ovmContext.coder.encode(tx.toStruct())
    const signature = signTypedDataLegacy(
      Buffer.from(arrayify(wallet.privateKey)),
      { data: createTypedParams(config, txBytes) }
    )

    const property = new Property(addr, [
      txBytes,
      Bytes.fromHexString(signature),
      EthCoder.encode(Address.from(wallet.address)),
      Bytes.fromString('typedData')
    ])

    const decision = await deciderManager.decide(property)
    expect(decision.outcome).toBeTruthy()
  })
})
