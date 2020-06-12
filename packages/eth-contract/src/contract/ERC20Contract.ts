import * as ethers from 'ethers'
import { IERC20DetailedContract } from '@cryptoeconomicslab/contract'
import { Address, BigNumber, Integer } from '@cryptoeconomicslab/primitives'

export class ERC20Contract implements IERC20DetailedContract {
  public static abi = [
    'function approve(address _spender, uint256 _value)',
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)'
  ]

  private connection: ethers.Contract
  private _name?: string
  private _symbol?: string
  private _decimals?: Integer

  constructor(readonly address: Address, signer: ethers.Signer) {
    this.connection = new ethers.Contract(
      address.data,
      ERC20Contract.abi,
      signer
    )
  }

  public async approve(spender: Address, amount: BigNumber) {
    try {
      const approveTx = await this.connection.approve(spender.data, amount.raw)
      await approveTx.wait()
    } catch (e) {
      throw new Error(`Invalid call: ${e}`)
    }
  }

  /**
   * name method returns name of PlasmaETH token.
   */
  public async name(): Promise<string> {
    if (this._name) return this._name
    try {
      const name = await this.connection.name()
      this._name = name
      return name
    } catch (e) {
      throw new Error(`Invalid call: ${e}. This ERC20 doesn't have name.`)
    }
  }

  /**
   * symbol method returns symbol of PlasmaETH token.
   */
  public async symbol(): Promise<string> {
    if (this._symbol) return this._symbol
    try {
      const symbol = await this.connection.symbol()
      this._symbol = symbol
      return symbol
    } catch (e) {
      throw new Error(`Invalid call: ${e}. This ERC20 doesn't have symbol.`)
    }
  }

  /**
   * decimals method returns decimal value of this token.
   * @returns return Integer object of decimal value
   */
  public async decimals(): Promise<Integer> {
    if (this._decimals) return this._decimals
    try {
      const decimals = Integer.from(await this.connection.decimals())
      this._decimals = decimals
      return decimals
    } catch (e) {
      throw new Error(`Invalid call: ${e}. This ERC20 doesn't have decimals.`)
    }
  }
}
