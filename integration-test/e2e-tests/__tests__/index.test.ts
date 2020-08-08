import * as ethers from 'ethers'
import {
  Address,
  Bytes,
  BigNumber,
  Integer,
  Range,
  Property
} from '@cryptoeconomicslab/primitives'
import { LevelKeyValueStore } from '@cryptoeconomicslab/level-kvs'
import initializeLightClient from '@cryptoeconomicslab/eth-plasma-light-client'
import LightClient, {
  Numberish,
  StateUpdateRepository,
  UserActionRepository
} from '@cryptoeconomicslab/plasma-light-client'
import JSBI from 'jsbi'
import parseEther = ethers.utils.parseEther
import parseUnits = ethers.utils.parseUnits
import formatUnits = ethers.utils.formatUnits
import UserAction, {
  ActionType
} from '@cryptoeconomicslab/plasma-light-client/lib/UserAction'
import { EthCoder } from '@cryptoeconomicslab/eth-coder'
import { Block, StateUpdate } from '@cryptoeconomicslab/plasma'
import { DateUtils } from '@cryptoeconomicslab/utils'
import { setupContext } from '@cryptoeconomicslab/context'
import config from '../config.local.json'

setupContext({ coder: EthCoder })

jest.setTimeout(140000)

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
  let carolLightClient: LightClient
  let senderWallet: ethers.Wallet
  let recieverWallet: ethers.Wallet
  let carolWallet: ethers.Wallet
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

  async function createClientFromPrivateKey(privateKey: string) {
    const provider = new ethers.providers.JsonRpcProvider(nodeEndpoint)
    const wallet = new ethers.Wallet(privateKey, provider)
    return await createClient(wallet)
  }

  async function increaseBlock() {
    for (let i = 0; i < 10; i++) {
      await operatorWallet.sendTransaction({
        to: operatorWallet.address,
        value: parseEther('0.00001')
      })
    }
  }

  async function wrapPETH(wallet: ethers.Wallet, amount: string) {
    const abi = ['function wrap(uint256 _amount) payable']
    const contract = new ethers.Contract(config.PlasmaETH, abi, wallet)
    const bigNumberifiedAmount = new ethers.utils.BigNumber(amount)
    try {
      const wrapTx = await contract.wrap(bigNumberifiedAmount, {
        value: bigNumberifiedAmount
      })
      await wrapTx.wait()
    } catch (e) {
      throw new Error(`Invalid call: ${e}`)
    }
  }

  async function depositPETH(
    lightClient: LightClient,
    wallet: ethers.Wallet,
    amount: string
  ) {
    await wrapPETH(wallet, parseUnitsToJsbi(amount).toString())
    await lightClient.deposit(parseUnitsToJsbi(amount), config.PlasmaETH)
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
    blockNumber: BigNumber,
    owner: Address
  ) {
    const OwnershipPredicateAddress = Address.from(
      config.deployedPredicateTable.OwnershipPredicate.deployedAddress
    )
    const depositContractAddress = Address.from(
      config.payoutContracts.DepositContract
    )
    const repository = await StateUpdateRepository.init(client['witnessDb'])
    const stateUpdates: StateUpdate[] = await repository.getVerifiedStateUpdates(
      depositContractAddress,
      new Range(BigNumber.from(0), BigNumber.MAX_NUMBER)
    )
    return new StateUpdate(
      depositContractAddress,
      stateUpdates[0].range,
      blockNumber,
      new Property(OwnershipPredicateAddress, [EthCoder.encode(owner)])
    )
  }

  function createBlock(blockNumber: BigNumber, stateUpdates: StateUpdate[]) {
    const stateUpdatesMap = new Map()
    stateUpdatesMap.set(config.PlasmaETH, stateUpdates)
    const timestamp = DateUtils.getCurrentDate()
    return new Block(
      blockNumber,
      stateUpdatesMap,
      BigNumber.from(0),
      Integer.from(timestamp)
    )
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
    await client['exitDispute']['contract'].claim(stateUpdate, inclusionProof)
  }

  function formatAction(action: UserAction) {
    return {
      type: action.type,
      amount: action.amount,
      counterParty: action.counterParty
    }
  }
  const defaultAddress = Address.default().data

  beforeEach(async () => {
    const provider = new ethers.providers.JsonRpcProvider(nodeEndpoint)
    senderWallet = ethers.Wallet.createRandom().connect(provider)
    recieverWallet = ethers.Wallet.createRandom().connect(provider)
    carolWallet = ethers.Wallet.createRandom().connect(provider)
    operatorWallet = new ethers.Wallet(
      '0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3',
      provider
    )

    await operatorWallet.sendTransaction({
      to: senderWallet.address,
      value: parseEther('1.0')
    })
    await operatorWallet.sendTransaction({
      to: recieverWallet.address,
      value: parseEther('1.0')
    })
    await operatorWallet.sendTransaction({
      to: carolWallet.address,
      value: parseEther('1.0')
    })

    aliceLightClient = await createClient(senderWallet)
    bobLightClient = await createClient(recieverWallet)
    carolLightClient = await createClient(carolWallet)
  })

  afterEach(async () => {
    aliceLightClient.stop()
    bobLightClient.stop()
    carolLightClient.stop()
  })

  /**
   * basic scenario
   * Alice deposit 0.1 ETH
   * Alice transfer 0.1 ETH to Bob
   * Bob attemts exit 0.1 ETH
   */
  test('user deposits, transfers and attempts exit asset', async () => {
    await depositPETH(aliceLightClient, senderWallet, '0.1')
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
    expect(exitList[0].stateUpdate.amount).toEqual(parseUnitsToJsbi('0.05'))

    await increaseBlock()

    await finalizeExit(bobLightClient)
    expect(await getL1PETHBalance(bobLightClient)).toEqual('0.05')

    console.log('[test 1] sync')
    aliceLightClient.stop()
    bobLightClient.stop()
    await aliceLightClient.start()
    await bobLightClient.start()
    await sleep(20000)
    expect(await getBalance(aliceLightClient)).toEqual('0.0')
    expect(await getBalance(bobLightClient)).toEqual('0.05')
    const aliceActions = await aliceLightClient.getAllUserActions()
    const bobActions = await bobLightClient.getAllUserActions()

    expect(aliceActions.map(formatAction)).toEqual([
      {
        type: ActionType.Deposit,
        amount: parseUnitsToJsbi('0.1'),
        counterParty: defaultAddress
      },
      {
        type: ActionType.Send,
        amount: parseUnitsToJsbi('0.1'),
        counterParty: bobLightClient.address
      }
    ])
    expect(bobActions.map(formatAction)).toEqual([
      {
        type: ActionType.Receive,
        amount: parseUnitsToJsbi('0.1'),
        counterParty: bobLightClient.address
      },
      {
        type: ActionType.Exit,
        amount: parseUnitsToJsbi('0.05'),
        counterParty: defaultAddress
      }
    ])

    console.log('[test 1] sync from empty')

    const aliceSyncLightClient = await createClientFromPrivateKey(
      aliceLightClient['wallet']['ethersWallet'].privateKey
    )
    const bobSyncLightClient = await createClientFromPrivateKey(
      bobLightClient['wallet']['ethersWallet'].privateKey
    )
    await sleep(20000)
    expect(await getBalance(aliceSyncLightClient)).toEqual('0.0')
    expect(await getBalance(bobSyncLightClient)).toEqual('0.05')

    const syncedExitList = await bobSyncLightClient.getPendingWithdrawals()
    expect(syncedExitList.length).toBe(1)
    expect(syncedExitList[0].stateUpdate.amount).toEqual(
      parseUnitsToJsbi('0.05')
    )

    const syncedAliceActions = await aliceSyncLightClient.getAllUserActions()
    const syncedBobActions = await bobSyncLightClient.getAllUserActions()

    expect(syncedAliceActions.map(formatAction)).toEqual([
      {
        type: ActionType.Deposit,
        amount: parseUnitsToJsbi('0.1'),
        counterParty: defaultAddress
      },
      {
        type: ActionType.Send,
        amount: parseUnitsToJsbi('0.1'),
        counterParty: bobLightClient.address
      }
    ])
    expect(syncedBobActions.map(formatAction)).toEqual([
      {
        type: ActionType.Receive,
        amount: parseUnitsToJsbi('0.1'),
        counterParty: bobLightClient.address
      }
    ])

    aliceSyncLightClient.stop()
    bobSyncLightClient.stop()
  })

  /**
   * exit deposit scenario
   * Alice deposits 0.1 ETH
   * Alice exit 0.05 ETH
   */
  test('user attempts exit depositted asset', async () => {
    await depositPETH(aliceLightClient, senderWallet, '0.1')
    await sleep(10000)

    expect(await getBalance(aliceLightClient)).toEqual('0.1')

    await aliceLightClient.startWithdrawal(
      parseUnitsToJsbi('0.05'),
      config.PlasmaETH
    )

    await sleep(10000)
    expect(await getBalance(aliceLightClient)).toEqual('0.05')

    const exitList = await aliceLightClient.getPendingWithdrawals()
    expect(exitList.length).toBe(1)
    expect(exitList[0].stateUpdate.amount).toEqual(parseUnitsToJsbi('0.05'))

    console.log('[test 2] sync test')
    aliceLightClient.stop()
    await aliceLightClient.start()
    await sleep(20000)
    expect(await getBalance(aliceLightClient)).toEqual('0.05')
    const exitList2 = await aliceLightClient.getPendingWithdrawals()
    expect(exitList2.length).toBe(1)
    expect(exitList2[0].stateUpdate.amount).toEqual(parseUnitsToJsbi('0.05'))
    const aliceActions = await aliceLightClient.getAllUserActions()
    expect(aliceActions.map(formatAction)).toEqual([
      {
        type: ActionType.Deposit,
        amount: parseUnitsToJsbi('0.1'),
        counterParty: defaultAddress
      }
    ])

    console.log('[test 2] sync test from empty')
    // check pending exits are synced
    const aliceSyncLightClient = await createClientFromPrivateKey(
      aliceLightClient['wallet']['ethersWallet'].privateKey
    )
    await sleep(20000)
    expect(await getBalance(aliceSyncLightClient)).toEqual('0.05')
    const syncedExitList = await aliceSyncLightClient.getPendingWithdrawals()
    expect(syncedExitList.length).toBe(1)
    expect(syncedExitList[0].stateUpdate.amount).toEqual(
      parseUnitsToJsbi('0.05')
    )

    await increaseBlock()

    expect(await getL1PETHBalance(aliceLightClient)).toEqual('0.0')
    await finalizeExit(aliceLightClient)
    expect(await getL1PETHBalance(aliceLightClient)).toEqual('0.05')

    const aliceActionsAfterExit = await aliceLightClient.getAllUserActions()
    expect(aliceActionsAfterExit.map(formatAction)).toEqual([
      {
        type: ActionType.Deposit,
        amount: parseUnitsToJsbi('0.1'),
        counterParty: defaultAddress
      },
      {
        type: ActionType.Exit,
        amount: parseUnitsToJsbi('0.05'),
        counterParty: defaultAddress
      }
    ])
    const exitListAfterCompleted = await aliceLightClient.getPendingWithdrawals()
    expect(exitListAfterCompleted).toEqual([])
  })

  /**
   * multiple transfers scenario
   * Alice and Bob deposit 0.5 ETH
   * Alice sends 0.2 ETH to Bob by 2 transactions
   * Bob sends 0.1 ETH to Alice by 1 transaction
   * exit all asset
   */
  test('multiple transfers in same block', async () => {
    await depositPETH(aliceLightClient, senderWallet, '0.5')
    await depositPETH(bobLightClient, recieverWallet, '0.5')

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

    const aliceSyncLightClient = await createClientFromPrivateKey(
      aliceLightClient['wallet']['ethersWallet'].privateKey
    )
    const bobSyncLightClient = await createClientFromPrivateKey(
      bobLightClient['wallet']['ethersWallet'].privateKey
    )
    await sleep(20000)
    expect(await getBalance(aliceSyncLightClient)).toEqual('0.4')
    expect(await getBalance(bobSyncLightClient)).toEqual('0.6')
    aliceSyncLightClient.stop()
    bobSyncLightClient.stop()

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

  test('transfers in multiple blocks', async () => {
    await depositPETH(aliceLightClient, senderWallet, '0.5')
    await depositPETH(bobLightClient, recieverWallet, '0.5')
    await depositPETH(carolLightClient, carolWallet, '0.5')

    await sleep(10000)

    await checkBalance(aliceLightClient, '0.5')
    await checkBalance(bobLightClient, '0.5')
    await checkBalance(carolLightClient, '0.5')

    await aliceLightClient.transfer(
      parseUnitsToJsbi('0.2'),
      config.PlasmaETH,
      bobLightClient.address
    )
    await carolLightClient.transfer(
      parseUnitsToJsbi('0.2'),
      config.PlasmaETH,
      bobLightClient.address
    )

    await sleep(20000)

    await checkBalance(aliceLightClient, '0.3')
    await checkBalance(bobLightClient, '0.9')
    await checkBalance(carolLightClient, '0.3')

    await bobLightClient.transfer(
      parseUnitsToJsbi('0.8'),
      config.PlasmaETH,
      aliceLightClient.address
    )

    await sleep(20000)

    await checkBalance(aliceLightClient, '1.1')
    await checkBalance(bobLightClient, '0.1')
    await checkBalance(carolLightClient, '0.3')

    aliceLightClient.stop()
    bobLightClient.stop()
    carolLightClient.stop()
    await aliceLightClient.start()
    await bobLightClient.start()
    await carolLightClient.start()

    await sleep(5000)

    await checkBalance(aliceLightClient, '1.1')
    await checkBalance(bobLightClient, '0.1')
    await checkBalance(carolLightClient, '0.3')

    const aliceActions = await aliceLightClient.getAllUserActions()

    expect(aliceActions.map(formatAction)).toEqual([
      {
        type: ActionType.Deposit,
        amount: parseUnitsToJsbi('0.5'),
        counterParty: defaultAddress
      },
      {
        type: ActionType.Send,
        amount: parseUnitsToJsbi('0.2'),
        counterParty: bobLightClient.address
      },
      {
        type: ActionType.Receive,
        amount: parseUnitsToJsbi('0.2'),
        counterParty: aliceLightClient.address
      },
      {
        type: ActionType.Receive,
        amount: parseUnitsToJsbi('0.5'),
        counterParty: aliceLightClient.address
      },
      {
        type: ActionType.Receive,
        amount: parseUnitsToJsbi('0.1'),
        counterParty: aliceLightClient.address
      }
    ])
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
    await depositPETH(aliceLightClient, senderWallet, '0.5')
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

    await depositPETH(aliceLightClient, senderWallet, '0.1')
    await depositPETH(bobLightClient, recieverWallet, '0.8')
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
    await depositPETH(aliceLightClient, senderWallet, '0.2')
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

    await aliceLightClient.transfer(
      parseUnitsToJsbi('0.1'),
      config.PlasmaETH,
      bobLightClient.address
    )
    await sleep(20000)

    await checkBalance(aliceLightClient, '0.1')
    await checkBalance(bobLightClient, '0.1')

    const aliceActions = await aliceLightClient.getAllUserActions()
    const bobActions = await bobLightClient.getAllUserActions()

    expect(aliceActions[0].type).toEqual(ActionType.Deposit)
    expect(aliceActions[0].amount).toEqual(parseUnitsToJsbi('0.2'))
    expect(bobActions[0].type).toEqual(ActionType.Receive)
    expect(bobActions[0].amount).toEqual(parseUnitsToJsbi('0.1'))
  })

  test('spent challenge', async () => {
    const getStateUpdates = async (
      client: LightClient,
      depositContractAddress: string,
      amount: JSBI
    ) => {
      const addr = Address.from(depositContractAddress)
      const repository = await StateUpdateRepository.init(client['witnessDb'])
      return await repository.resolveStateUpdate(addr, amount)
    }
    const exit = async (client: LightClient, stateUpdates: any[]) => {
      for (const stateUpdate of stateUpdates) {
        await client['exitDispute'].claimExit(stateUpdate)
      }
    }

    await depositPETH(aliceLightClient, senderWallet, '0.5')
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

    await sleep(30000)

    expect(await getBalance(aliceLightClient)).toEqual('0.1')
    expect(await getBalance(bobLightClient)).toEqual('0.4')

    await exit(bobLightClient, stateUpdates || [])

    await increaseBlock()

    await expect(finalizeExit(bobLightClient)).rejects.toEqual(
      new Error(
        'VM Exception while processing transaction: revert undecided challenge exists'
      )
    )
  })

  test('invalid history challenge', async () => {
    console.log('invalid history challenge')
    const submitInvalidBlock = async (blockNumber: BigNumber, block: Block) => {
      const abi = ['function submitRoot(uint64 blkNumber, bytes32 _root)']
      const connection = new ethers.Contract(
        config.commitment,
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

    await depositPETH(aliceLightClient, senderWallet, '0.5')
    await sleep(10000)

    expect(await getBalance(aliceLightClient)).toEqual('0.5')

    await aliceLightClient.transfer(
      parseUnitsToJsbi('0.5'),
      config.PlasmaETH,
      bobLightClient.address
    )
    await sleep(30000)

    expect(await getBalance(aliceLightClient)).toEqual('0.0')
    expect(await getBalance(bobLightClient)).toEqual('0.5')

    const blockNumber: BigNumber = await aliceLightClient[
      'commitmentContract'
    ].getCurrentBlock()

    const b = BigNumber.from(Number(blockNumber.data.toString()) + 1)

    const invalidStateUpdate = await createInvalidStateUpdate(
      bobLightClient,
      b,
      Address.from(aliceLightClient.address)
    )

    const block = createBlock(b, [invalidStateUpdate])
    await submitInvalidBlock(
      BigNumber.from(Number(blockNumber.data.toString()) + 1),
      block
    )
    await exitInvalidStateUpdate(aliceLightClient, invalidStateUpdate, block)

    await increaseBlock()

    await expect(finalizeExit(aliceLightClient)).rejects.toEqual(
      new Error('VM Exception while processing transaction: revert')
    )
  })
})
