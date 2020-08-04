jest.unmock('ethers')
const { EthWallet } = require('../src/EthWallet')
const ethers = require('ethers')
const { UnsignedTransaction } = require('@cryptoeconomicslab/plasma')
const {
  Address,
  BigNumber,
  Bytes,
  Property,
  Range
} = require('@cryptoeconomicslab/primitives')
const { setupContext } = require('@cryptoeconomicslab/context')
const JsonCoder = require('@cryptoeconomicslab/coder')
setupContext({ coder: JsonCoder.default })

const config = {
  deployedPredicateTable: {
    OwnershipPredicate: {
      deployedAddress: '0x13274fe19c0178208bcbee397af8167a7be27f6f',
      source: [
        {
          type: 'CompiledPredicate',
          name: 'Ownership',
          inputDefs: [
            { name: 'owner', type: 'Address' },
            { name: 'tx', type: 'Property' }
          ],
          contracts: [],
          entryPoint: 'OwnershipT',
          constants: [{ varType: 'bytes', name: 'verifierType' }]
        }
      ]
    }
  }
}

const mockWallet = jest.fn().mockImplementation(privateKey => {
  return {
    address: new ethers.utils.SigningKey(privateKey).address,
    getBalance: jest.fn().mockImplementation(async () => {
      return '100'
    }),
    privateKey: privateKey
  }
})
const mockContract = jest.fn().mockImplementation(() => {
  return {
    connect: jest.fn().mockImplementation(() => {
      return {
        balanceOf: jest.fn().mockImplementation(async () => {
          return '100'
        }),
        decimals: jest.fn().mockImplementation(async () => {
          return 8
        }),
        symbol: jest.fn().mockImplementation(async () => {
          return 'DAI'
        })
      }
    })
  }
})
ethers.Wallet = mockWallet
ethers.Contract = mockContract

describe('EthWallet', () => {
  let wallet
  const depositContractAddress = Address.from(
    '0x4e71920b7330515faf5ea0c690f1ad06a85fb60c'
  )
  const range = new Range(
    BigNumber.fromString('0'),
    BigNumber.fromString('100000000000000000')
  )
  const toAddress = Address.from('0xf17f52151ebef6c7334fad080c5704d77216b732')
  const predicateAddress = Address.from(
    '0x13274fe19c0178208bcbee397af8167a7be27f6f'
  )

  function createTransaction(stateObject) {
    const tx = new UnsignedTransaction(
      depositContractAddress,
      range,
      BigNumber.from(0),
      stateObject,
      Address.default()
    )
    return tx
  }
  const tx = createTransaction(
    new Property(predicateAddress, [ovmContext.coder.encode(toAddress)])
  )

  beforeEach(async () => {
    mockContract.mockClear()
    mockWallet.mockClear()
    wallet = new EthWallet(
      new ethers.Wallet(
        '0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3'
      ),
      config
    )
  })
  describe('signMessage', () => {
    it('succeed to sign hex string', async () => {
      const signedTx = await tx.sign(wallet)
      const signature = signedTx.signature
      expect(signature).toBeTruthy()
    })
  })
  describe('verifyMySignature', () => {
    it('succeed to verify signature', async () => {
      const signedTx = await tx.sign(wallet)
      const signatureDigest = signedTx.signature
      const verify = await wallet.verifyMySignature(
        signedTx.message,
        signatureDigest
      )
      expect(verify).toBeTruthy()
    })
    it('fail to verify signature', async () => {
      const bobWallet = new EthWallet(
        new ethers.Wallet(
          '0x17d08f5fe8c77af811caa0c9a187e668ce3b74a99acc3f6d976f075fa8e0be55'
        ),
        config
      )
      const signedTx = await tx.sign(bobWallet)
      const bobSignatureDigest = signedTx.signature
      const verify = await wallet.verifyMySignature(
        signedTx.message,
        bobSignatureDigest,
        Bytes.default()
      )
      expect(verify).toBeFalsy()
    })
  })
  describe('getL1Balance', () => {
    it('succeed to get L1 balance', async () => {
      const balance = await wallet.getL1Balance()
      expect(balance.value.raw).toBe('100')
      expect(balance.decimals).toBe(18)
      expect(balance.symbol).toBe('ETH')
    })
    it('succeed to get L1 (ERC20) balance', async () => {
      const tokenAddress = Address.from(
        '0xd0a1e359811322d97991e03f863a0c30c2cf029c'
      )
      const balance = await wallet.getL1Balance(tokenAddress)
      expect(balance.value.raw).toBe('100')
      expect(balance.decimals).toBe(8)
      expect(balance.symbol).toBe('DAI')
    })
  })
})
