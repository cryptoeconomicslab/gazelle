import {
  DeciderManager,
  IsValidSignatureDecider,
  ForAllSuchThatDecider,
  LogicalConnective,
  CompiledPredicate,
  CompiledDecider
} from '../../src'
import { Address, Bytes, Property } from '@cryptoeconomicslab/primitives'
import * as ethers from 'ethers'
import { Secp256k1Signer } from '@cryptoeconomicslab/signature'
import { InMemoryKeyValueStore } from '@cryptoeconomicslab/level-kvs'
import EthCoder from '@cryptoeconomicslab/eth-coder'
import { setupContext } from '@cryptoeconomicslab/context'
import { ForAllSuchThatDeciderAddress } from '../helpers/initiateDeciderManager'
import { OWNERSHIP_SOURCE } from '../decompiler/TestSource'
setupContext({ coder: EthCoder })

describe('IsValidSignatureDecider', () => {
  const addr = Address.from('0x0000000000000000000000000000000000000001')
  const ownershipPredicateAddr = Address.from(
    '0x13274fe19c0178208bcbee397af8167a7be27f6f'
  )
  const compiledPredicate = CompiledPredicate.fromSource(
    ownershipPredicateAddr,
    OWNERSHIP_SOURCE
  )
  const compiledDecider = new CompiledDecider(compiledPredicate, {
    secp256k1: Bytes.fromString('typedData')
  })

  const db = new InMemoryKeyValueStore(Bytes.fromString('test'))
  const deciderManager = new DeciderManager(db)
  deciderManager.setDecider(
    ForAllSuchThatDeciderAddress,
    new ForAllSuchThatDecider(),
    LogicalConnective.ForAllSuchThat
  )
  deciderManager.setDecider(addr, new IsValidSignatureDecider())
  deciderManager.setDecider(ownershipPredicateAddr, compiledDecider)
  deciderManager.setCompiledPredicate(
    compiledPredicate.getPredicateName(),
    compiledPredicate
  )
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
    const property = new Property(addr, [
      Bytes.fromHexString(
        '0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000200000000000000000000000004e71920b7330515faf5ea0c690f1ad06a85fb60c00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000016345785d8a00000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000013274fe19c0178208bcbee397af8167a7be27f6f0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000020000000000000000000000000f17f52151ebef6c7334fad080c5704d77216b732'
      ),
      // sign with MetaMask
      Bytes.fromHexString(
        '0x50796a5cd37512a03bef440be4bbeee54245bd8bf7f7e8e2ae0ef845844ca7c47d06a039145e4f59d11ffd8564f1817855666449c243513ea5e20ff90dd0b9171c'
      ),
      EthCoder.encode(
        Address.from('0x627306090abab3a6e1400e9345bc60c78a8bef57')
      ),
      Bytes.fromString('typedData')
    ])

    const decision = await deciderManager.decide(property)
    console.log(decision)
    expect(decision.outcome).toBeTruthy()
  })
})
