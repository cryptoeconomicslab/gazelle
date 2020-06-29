import {
  Address,
  Range,
  BigNumber,
  Bytes,
  Property
} from '@cryptoeconomicslab/primitives'
import { EthCoder as Coder } from '@cryptoeconomicslab/eth-coder'
import { setupContext } from '@cryptoeconomicslab/context'
import {
  initializeDeciderManager,
  SampleDeciderAddress
} from '../helpers/initiateDeciderManager'
import { CompiledDecider, CompiledPredicate, DeciderManager } from '../../src'
import { putWitness, replaceHint } from '@cryptoeconomicslab/db'
import { EXIT_DEPOSIT_SOURCE, STATEUPDATE_SOURCE } from './TestSource'
setupContext({ coder: Coder })

describe('ExitDeposit', () => {
  let deciderManager: DeciderManager
  const tokenAddress = Address.from(
    '0x0888888888888888888888888888888888888888'
  )
  const txAddress = Address.from('0x7777777777777777777777777777777777777777')

  const exitDepositAddress = Address.from(
    '0x0111111111111111111111111111111111111200'
  )
  const exitDepositPredicate = CompiledPredicate.fromSource(
    exitDepositAddress,
    EXIT_DEPOSIT_SOURCE
  )
  const exitDepositDecider = new CompiledDecider(exitDepositPredicate)

  const stateUpdateAddress = Address.from(
    '0x0111111111111111111111111111111111111111'
  )
  const stateUpdatePredicate = CompiledPredicate.fromSource(
    stateUpdateAddress,
    STATEUPDATE_SOURCE
  )
  const stateUpdateDecider = new CompiledDecider(stateUpdatePredicate, {
    txAddress: Coder.encode(txAddress)
  })
  const stateObject = new Property(SampleDeciderAddress, [
    Bytes.fromHexString('0x01')
  ])

  // exit deposit does not use checkpoint at all
  const dummyCheckPoint = Bytes.fromHexString('0x01')

  const range = new Range(BigNumber.from(0), BigNumber.from(5))
  const blockNumber = BigNumber.from(1)
  const suProperty = new Property(stateUpdateAddress, [
    Coder.encode(tokenAddress),
    Coder.encode(range.toStruct()),
    Coder.encode(blockNumber),
    Coder.encode(stateObject.toStruct())
  ])

  beforeEach(() => {
    deciderManager = initializeDeciderManager()
    deciderManager.setDecider(exitDepositAddress, exitDepositDecider)
    deciderManager.setDecider(stateUpdateAddress, stateUpdateDecider)
  })

  test('decides to true', async () => {
    const property = new Property(exitDepositAddress, [
      Coder.encode(suProperty.toStruct()),
      dummyCheckPoint
    ])

    const decision = await deciderManager.decide(property)

    expect(decision.outcome).toBeTruthy()
    expect(decision.challenge).toEqual({
      property: suProperty,
      challengeInputs: []
    })
  })

  test('decides to false', async () => {
    // prepare witness tx
    const txProperty = new Property(txAddress, [
      Coder.encode(tokenAddress),
      Coder.encode(range.toStruct()),
      Coder.encode(BigNumber.from(4)),
      Coder.encode(stateObject.toStruct())
    ])

    const hint = replaceHint('tx.block${b}.range${token},RANGE,${range}', {
      b: Coder.encode(blockNumber),
      token: Coder.encode(tokenAddress),
      range: Coder.encode(range.toStruct())
    })

    await putWitness(
      deciderManager.witnessDb,
      hint,
      Coder.encode(txProperty.toStruct())
    )
    const suProperty = new Property(stateUpdateAddress, [
      Coder.encode(tokenAddress),
      Coder.encode(range.toStruct()),
      Coder.encode(blockNumber),
      Coder.encode(stateObject.toStruct())
    ])
    const property = new Property(exitDepositAddress, [
      Coder.encode(suProperty.toStruct()),
      dummyCheckPoint
    ])

    const decision = await deciderManager.decide(property)

    expect(decision.outcome).toBeFalsy()
    expect(decision.challenge).toEqual({
      property: suProperty,
      challengeInputs: []
    })
  })
})
