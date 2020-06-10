import * as ethers from 'ethers'
import {
  Address,
  Bytes,
  BigNumber,
  Range
} from '@cryptoeconomicslab/primitives'
import { LevelKeyValueStore } from '@cryptoeconomicslab/level-kvs'
import initializeLightClient from '@cryptoeconomicslab/eth-plasma-light-client'
import LightClient from '@cryptoeconomicslab/plasma-light-client'
import JSBI from 'jsbi'
import parseEther = ethers.utils.parseEther
import parseUnits = ethers.utils.parseUnits
import formatUnits = ethers.utils.formatUnits
import { ActionType } from '@cryptoeconomicslab/plasma-light-client/lib/UserAction'
import { EthCoder } from '@cryptoeconomicslab/eth-coder'
import { Block, StateUpdate } from '@cryptoeconomicslab/plasma'
import { Property } from '@cryptoeconomicslab/ovm'
import config from '../config.local.json'

declare type Numberish =
  | {
      toString(): string
    }
  | {
      valueOf: string | number
    }
  | {
      [Symbol.toPrimitive]: any
    }

jest.setTimeout(120000)

function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

function parseUnitsToJsbi(amount: string) {
  return JSBI.BigInt(parseUnits(amount, 18).toString())
}

function formatUnitsFromJsbi(amount: Numberish) {
  return formatUnits(amount.toString(), 18)
}

describe('light client', () => {
  const nodeEndpoint = 'http://ganache:8545'
  const aggregatorEndpoint = 'http://aggregator:3000'
  let aliceLightClient: LightClient
  let bobLightClient: LightClient
  let senderWallet: ethers.Wallet
  let recieverWallet: ethers.Wallet
  let operatorWallet: ethers.Wallet

  async function createClient(wallet: ethers.Wallet) {
    const kvs = new LevelKeyValueStore(
      Bytes.fromString('plasma_light_client_' + wallet.address)
    )
    const client = await initializeLightClient({
      wallet,
      kvs,
      config: config as any,
      aggregatorEndpoint
    })
    await client.start()
    return client
  }

  async function increaseBlock() {
    for (let i = 0; i < 10; i++) {
      await operatorWallet.sendTransaction({
        to: operatorWallet.address,
        value: parseEther('0.00001')
      })
    }
  }

  async function checkBalance(lightClient: LightClient, amount: string) {
    const balance = await lightClient.getBalance()
    // compare string rep because jsbi version varies
    expect(balance[0].amount.toString()).toBe(
      parseUnitsToJsbi(amount).toString()
    )
  }

  async function getBalance(lightClient: LightClient) {
    const balance = await lightClient.getBalance()
    return formatUnitsFromJsbi(balance[0].amount)
  }

  async function getL1PETHBalance(lightClient: LightClient) {
    const abi = ['function balanceOf(address) view returns (uint256)']
    const connection = new ethers.Contract(
      config.PlasmaETH,
      abi,
      lightClient['wallet']['ethersWallet']
    )
    const balance = await connection.balanceOf(lightClient.address)
    return formatUnits(balance, 18)
  }

  async function finalizeExit(lightClient: LightClient) {
    const exitList = await lightClient.getPendingWithdrawals()
    for (let i = 0; i < exitList.length; i++) {
      await lightClient.completeWithdrawal(exitList[i])
      // Consecutive finalizeExit call must fail because of invalid Deposited range ID
      await sleep(10000)
    }
  }

  // helpers for challenge scenarios
  async function createInvalidStateUpdate(
    client: LightClient,
    blockNumber: BigNumber
  ) {
    const StateUpdatePredicateAddress = Address.from(
      config.deployedPredicateTable.StateUpdatePredicate.deployedAddress
    )
    const OwnershipPredicateAddress = Address.from(
      config.deployedPredicateTable.OwnershipPredicate.deployedAddress
    )
    const depositContractAddress = Address.from(
      config.payoutContracts.DepositContract
    )
    const owner = Address.from(client.address)
    const stateUpdates: StateUpdate[] = await client[
      'stateManager'
    ].getVerifiedStateUpdates(
      depositContractAddress,
      new Range(BigNumber.from(0), BigNumber.MAX_NUMBER)
    )
    return new StateUpdate(
      StateUpdatePredicateAddress,
      depositContractAddress,
      stateUpdates[0].range,
      blockNumber,
      new Property(OwnershipPredicateAddress, [EthCoder.encode(owner)])
    )
  }

  function createBlock(blockNumber: BigNumber, stateUpdates: StateUpdate[]) {
    const stateUpdatesMap = new Map()
    stateUpdatesMap.set(config.PlasmaETH, stateUpdates)
    return new Block(blockNumber, stateUpdatesMap)
  }

  async function exitInvalidStateUpdate(
    client: LightClient,
    stateUpdate: StateUpdate,
    block: Block
  ) {
    const inclusionProof = block.getInclusionProof(stateUpdate)
    if (inclusionProof === null) {
      throw new Error("stateUpdate doesn't included")
    }
    const exitProperty = new Property(
      Address.from(config.deployedPredicateTable.ExitPredicate.deployedAddress),
      [stateUpdate.property.toStruct(), inclusionProof.toStruct()].map(
        EthCoder.encode
      )
    )
    await client['adjudicationContract'].claimProperty(exitProperty)
  }

  beforeEach(async () => {
    const provider = new ethers.providers.JsonRpcProvider(nodeEndpoint)
    senderWallet = ethers.Wallet.createRandom().connect(provider)
    recieverWallet = ethers.Wallet.createRandom().connect(provider)
    operatorWallet = new ethers.Wallet(
      '0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3',
      provider
    )
    const kvs1 = new LevelKeyValueStore(
      Bytes.fromString('plasma_light_client_' + senderWallet.address)
    )
    const kvs2 = new LevelKeyValueStore(
      Bytes.fromString('plasma_light_client_' + recieverWallet.address)
    )

    await operatorWallet.sendTransaction({
      to: senderWallet.address,
      value: parseEther('1.0')
    })
    await operatorWallet.sendTransaction({
      to: recieverWallet.address,
      value: parseEther('1.0')
    })

    aliceLightClient = await createClient(senderWallet)
    bobLightClient = await createClient(recieverWallet)
  })

  afterEach(async () => {
    aliceLightClient.stop()
    bobLightClient.stop()
  })

  /**
   * basic scenario
   * Alice deposit 0.1 ETH
   * Alice transfer 0.1 ETH to Bob
   * Bob attemts exit 0.1 ETH
   */
  test('user deposits, transfers and attempts exit asset', async () => {
    await aliceLightClient.deposit(parseUnitsToJsbi('0.1'), config.PlasmaETH)
    await sleep(10000)

    expect(await getBalance(aliceLightClient)).toEqual('0.1')

    await aliceLightClient.transfer(
      parseUnitsToJsbi('0.1'),
      config.PlasmaETH,
      bobLightClient.address
    )
    await sleep(20000)

    expect(await getBalance(aliceLightClient)).toEqual('0.0')
    expect(await getBalance(bobLightClient)).toEqual('0.1')

    await bobLightClient.startWithdrawal(
      parseUnitsToJsbi('0.05'),
      config.PlasmaETH
    )
    await sleep(10000)

    expect(await getBalance(bobLightClient)).toEqual('0.05')

    const exitList = await bobLightClient.getPendingWithdrawals()
    expect(exitList.length).toBe(1)

    await increaseBlock()

    expect(await getL1PETHBalance(bobLightClient)).toEqual('0.0')
    await finalizeExit(bobLightClient)
    expect(await getL1PETHBalance(bobLightClient)).toEqual('0.05')

    const aliceActions = await aliceLightClient.getAllUserActions()
    const bobActions = await bobLightClient.getAllUserActions()

    // TODO: Send action isn't stored
    // expect(aliceActions[0].type).toEqual(ActionType.Send)
    // expect(aliceActions[0].amount).toEqual(parseUnitsToJsbi('0.1'))
    expect(aliceActions[0].type).toEqual(ActionType.Deposit)
    expect(aliceActions[0].amount).toEqual(parseUnitsToJsbi('0.1'))
    expect(bobActions[0].type).toEqual(ActionType.Exit)
    expect(bobActions[0].amount).toEqual(parseUnitsToJsbi('0.05'))
    expect(bobActions[1].type).toEqual(ActionType.Receive)
    expect(bobActions[1].amount).toEqual(parseUnitsToJsbi('0.1'))
  })

  /**
   * exit deposit scenario
   * Alice deposits 0.1 ETH
   * Alice exit 0.05 ETH
   */
  test('user attempts exit depositted asset', async () => {
    const createClientFromPrivateKey = async (privateKey: string) => {
      const provider = new ethers.providers.JsonRpcProvider(nodeEndpoint)
      const wallet = new ethers.Wallet(privateKey, provider)
      return await createClient(wallet)
    }
    await aliceLightClient.deposit(parseUnitsToJsbi('0.1'), config.PlasmaETH)
    await sleep(10000)

    expect(await getBalance(aliceLightClient)).toEqual('0.1')

    await aliceLightClient.startWithdrawal(
      parseUnitsToJsbi('0.05'),
      config.PlasmaETH
    )
    await sleep(10000)
    const client = await createClientFromPrivateKey(
      aliceLightClient['wallet']['ethersWallet'].privateKey
    )
    await sleep(10000)

    expect(await getBalance(aliceLightClient)).toEqual('0.05')

    const exitList = await aliceLightClient.getPendingWithdrawals()
    expect(exitList.length).toBe(1)
    const syncedExitList = await client.getPendingWithdrawals()
    expect(syncedExitList.length).toBe(1)

    await increaseBlock()

    expect(await getL1PETHBalance(aliceLightClient)).toEqual('0.0')
    await finalizeExit(aliceLightClient)
    expect(await getL1PETHBalance(aliceLightClient)).toEqual('0.05')
    client.stop()
  })

  /**
   * multiple transfers scenario
   * Alice and Bob deposit 0.5 ETH
   * Alice sends 0.2 ETH to Bob by 2 transactions
   * Bob sends 0.1 ETH to Alice by 1 transaction
   * exit all asset
   */
  test('multiple transfers in same block', async () => {
    console.log('multiple transfers in same block')
    await aliceLightClient.deposit(parseUnitsToJsbi('0.5'), config.PlasmaETH)
    await bobLightClient.deposit(parseUnitsToJsbi('0.5'), config.PlasmaETH)

    await sleep(10000)

    await checkBalance(aliceLightClient, '0.5')
    await checkBalance(bobLightClient, '0.5')

    await aliceLightClient.transfer(
      parseUnitsToJsbi('0.1'),
      config.PlasmaETH,
      bobLightClient.address
    )
    await bobLightClient.transfer(
      parseUnitsToJsbi('0.1'),
      config.PlasmaETH,
      aliceLightClient.address
    )
    await aliceLightClient.transfer(
      parseUnitsToJsbi('0.1'),
      config.PlasmaETH,
      bobLightClient.address
    )

    await sleep(20000)

    await checkBalance(aliceLightClient, '0.4')
    await checkBalance(bobLightClient, '0.6')

    await aliceLightClient.startWithdrawal(
      parseUnitsToJsbi('0.4'),
      config.PlasmaETH
    )
    await bobLightClient.startWithdrawal(
      parseUnitsToJsbi('0.6'),
      config.PlasmaETH
    )
    await sleep(10000)

    await checkBalance(aliceLightClient, '0.0')
    await checkBalance(bobLightClient, '0.0')

    await increaseBlock()

    expect(await getL1PETHBalance(aliceLightClient)).toEqual('0.0')
    expect(await getL1PETHBalance(bobLightClient)).toEqual('0.0')
    await finalizeExit(aliceLightClient)
    await finalizeExit(bobLightClient)
    expect(await getL1PETHBalance(aliceLightClient)).toEqual('0.4')
    expect(await getL1PETHBalance(bobLightClient)).toEqual('0.6')
  })

  /**
   * deposit after withdraw scenario
   * Alice deposits 0.5 ETH
   * Alice sends 0.5 ETH to Bob
   * Bob attemts exit 0.3 ETH
   * Bob withdraw 0.2 ETH
   * Alice deposit 0.1 ETH
   * Bob deposit 0.8 ETH
   */
  test('deposit after withdraw', async () => {
    console.log('deposit after withdraw')
    await aliceLightClient.deposit(parseUnitsToJsbi('0.5'), config.PlasmaETH)
    await sleep(10000)

    expect(await getBalance(aliceLightClient)).toEqual('0.5')

    await aliceLightClient.transfer(
      parseUnitsToJsbi('0.5'),
      config.PlasmaETH,
      bobLightClient.address
    )
    await sleep(20000)

    expect(await getBalance(aliceLightClient)).toEqual('0.0')
    expect(await getBalance(bobLightClient)).toEqual('0.5')

    await bobLightClient.startWithdrawal(
      parseUnitsToJsbi('0.2'),
      config.PlasmaETH
    )
    await sleep(10000)

    expect(await getBalance(bobLightClient)).toEqual('0.3')

    await increaseBlock()

    expect(await getL1PETHBalance(bobLightClient)).toEqual('0.0')
    await finalizeExit(bobLightClient)
    expect(await getL1PETHBalance(bobLightClient)).toEqual('0.2')

    await aliceLightClient.deposit(parseUnitsToJsbi('0.1'), config.PlasmaETH)
    await bobLightClient.deposit(parseUnitsToJsbi('0.8'), config.PlasmaETH)
    await sleep(10000)

    expect(await getBalance(aliceLightClient)).toEqual('0.1')
    expect(await getBalance(bobLightClient)).toEqual('1.1')
  })

  /**
   * transfer after error
   * Alice deposit 0.2 ETH
   * Alice tries to send 0.5 ETH to Bob, but gets error
   * Alice tries to exit 0.5 ETH, but gets error
   * Alice sends 0.1 ETH to Bob
   */
  test('transfer after error', async () => {
    await aliceLightClient.deposit(parseUnitsToJsbi('0.2'), config.PlasmaETH)
    await sleep(10000)

    await checkBalance(aliceLightClient, '0.2')
    await checkBalance(bobLightClient, '0.0')

    await expect(
      aliceLightClient.transfer(
        parseUnitsToJsbi('0.5'),
        config.PlasmaETH,
        bobLightClient.address
      )
    ).rejects.toEqual(new Error('Not enough amount'))

    await expect(
      aliceLightClient.startWithdrawal(
        parseUnitsToJsbi('0.5'),
        config.PlasmaETH
      )
    ).rejects.toEqual(new Error('Insufficient amount'))

    await checkBalance(aliceLightClient, '0.2')
    await checkBalance(bobLightClient, '0.0')

    aliceLightClient.transfer(
      parseUnitsToJsbi('0.1'),
      config.PlasmaETH,
      bobLightClient.address
    )
    await sleep(20000)

    await checkBalance(aliceLightClient, '0.1')
    await checkBalance(bobLightClient, '0.1')

    const aliceActions = await aliceLightClient.getAllUserActions()
    const bobActions = await bobLightClient.getAllUserActions()

    // TODO: Send action isn't stored
    expect(aliceActions[0].type).toEqual(ActionType.Deposit)
    expect(aliceActions[0].amount).toEqual(parseUnitsToJsbi('0.2'))
    expect(bobActions[0].type).toEqual(ActionType.Receive)
    expect(bobActions[0].amount).toEqual(parseUnitsToJsbi('0.1'))
  })

  test('spent challenge', async () => {
    console.log('spent challenge')
    const getStateUpdates = async (
      client: LightClient,
      depositContractAddress: string,
      amount: JSBI
    ) => {
      const addr = Address.from(depositContractAddress)
      return await client['stateManager'].resolveStateUpdate(addr, amount)
    }
    const exit = async (client: LightClient, stateUpdates: any[]) => {
      for (const stateUpdate of stateUpdates) {
        const exitObject = await client['createExit'](stateUpdate)
        await client['adjudicationContract'].claimProperty(exitObject.property)
        await client['saveExit'](exitObject)
      }
    }

    await aliceLightClient.deposit(parseUnitsToJsbi('0.5'), config.PlasmaETH)
    await sleep(10000)

    expect(await getBalance(aliceLightClient)).toEqual('0.5')

    await aliceLightClient.transfer(
      parseUnitsToJsbi('0.5'),
      config.PlasmaETH,
      bobLightClient.address
    )
    await sleep(20000)

    expect(await getBalance(aliceLightClient)).toEqual('0.0')
    expect(await getBalance(bobLightClient)).toEqual('0.5')

    const stateUpdates = await getStateUpdates(
      bobLightClient,
      config.payoutContracts.DepositContract,
      parseUnitsToJsbi('0.5')
    )
    await bobLightClient.transfer(
      parseUnitsToJsbi('0.1'),
      config.PlasmaETH,
      aliceLightClient.address
    )

    await sleep(20000)

    expect(await getBalance(aliceLightClient)).toEqual('0.1')
    expect(await getBalance(bobLightClient)).toEqual('0.4')

    await exit(bobLightClient, stateUpdates)

    await increaseBlock()

    await expect(finalizeExit(bobLightClient)).rejects.toEqual(
      new Error('Exit property is not decidable')
    )
  })

  test('invalid inclusion proof', async () => {
    console.log('invalid inclusion proof')

    await aliceLightClient.deposit(parseUnitsToJsbi('0.5'), config.PlasmaETH)
    await sleep(10000)

    expect(await getBalance(aliceLightClient)).toEqual('0.5')

    await aliceLightClient.transfer(
      parseUnitsToJsbi('0.5'),
      config.PlasmaETH,
      bobLightClient.address
    )
    await sleep(20000)

    expect(await getBalance(aliceLightClient)).toEqual('0.0')
    expect(await getBalance(bobLightClient)).toEqual('0.5')

    const blockNumber: BigNumber = await aliceLightClient[
      'commitmentContract'
    ].getCurrentBlock()

    const invalidStateUpdate = await createInvalidStateUpdate(
      bobLightClient,
      blockNumber
    )
    const block = createBlock(blockNumber, [invalidStateUpdate])

    await exitInvalidStateUpdate(aliceLightClient, invalidStateUpdate, block)

    await increaseBlock()

    await expect(finalizeExit(aliceLightClient)).rejects.toEqual(
      new Error('revert')
    )
  })

  test('invalid history challenge', async () => {
    console.log('invalid history challenge')
    const submitInvalidBlock = async (blockNumber: BigNumber, block: Block) => {
      const abi = ['function submitRoot(uint64 blkNumber, bytes32 _root)']
      const connection = new ethers.Contract(
        config.commitmentContract,
        abi,
        operatorWallet
      )
      await connection.submitRoot(
        blockNumber.raw,
        block
          .getTree()
          .getRoot()
          .toHexString()
      )
    }

    await aliceLightClient.deposit(parseUnitsToJsbi('0.5'), config.PlasmaETH)
    await sleep(10000)

    expect(await getBalance(aliceLightClient)).toEqual('0.5')

    await aliceLightClient.transfer(
      parseUnitsToJsbi('0.5'),
      config.PlasmaETH,
      bobLightClient.address
    )
    await sleep(20000)

    expect(await getBalance(aliceLightClient)).toEqual('0.0')
    expect(await getBalance(bobLightClient)).toEqual('0.5')

    const blockNumber: BigNumber = await aliceLightClient[
      'commitmentContract'
    ].getCurrentBlock()

    const invalidStateUpdate = await createInvalidStateUpdate(
      bobLightClient,
      blockNumber
    )

    const block = createBlock(blockNumber, [invalidStateUpdate])
    await submitInvalidBlock(
      BigNumber.from(Number(blockNumber.data.toString()) + 1),
      block
    )
    await exitInvalidStateUpdate(aliceLightClient, invalidStateUpdate, block)

    await increaseBlock()

    await expect(finalizeExit(aliceLightClient)).rejects.toEqual(
      new Error('revert')
    )
  })
})
