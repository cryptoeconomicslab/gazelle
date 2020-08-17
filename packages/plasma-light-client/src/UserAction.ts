import {
  BigNumber,
  Bytes,
  Range,
  Struct,
  Address
} from '@cryptoeconomicslab/primitives'
import JSBI from 'jsbi'

export enum ActionType {
  Deposit = 'Deposit',
  Exit = 'Exit',
  Send = 'Send',
  Receive = 'Receive'
}

export function createDepositUserAction(
  tokenAddress: Address,
  range: Range,
  blockNumber: BigNumber,
  chunkId: Bytes
): UserAction {
  return new UserAction(
    ActionType.Deposit,
    tokenAddress,
    range,
    Address.default(),
    blockNumber,
    chunkId
  )
}

export function createExitUserAction(
  tokenAddress: Address,
  range: Range,
  blockNumber: BigNumber,
  chunkId: Bytes
): UserAction {
  return new UserAction(
    ActionType.Exit,
    tokenAddress,
    range,
    Address.default(),
    blockNumber,
    chunkId
  )
}

export function createSendUserAction(
  tokenAddress: Address,
  range: Range,
  to: Address,
  blockNumber: BigNumber,
  chunkId: Bytes
): UserAction {
  return new UserAction(
    ActionType.Send,
    tokenAddress,
    range,
    to,
    blockNumber,
    chunkId
  )
}

export function createReceiveUserAction(
  tokenAddress: Address,
  range: Range,
  from: Address,
  blockNumber: BigNumber,
  chunkId: Bytes
): UserAction {
  return new UserAction(
    ActionType.Receive,
    tokenAddress,
    range,
    from,
    blockNumber,
    chunkId
  )
}

/**
 * UserAction class to represent user action history
 */
export default class UserAction {
  constructor(
    private _type: ActionType,
    private _tokenContractAddress: Address,
    private _range: Range,
    private _counterParty: Address,
    private _blockNumber: BigNumber,
    private _chunkId: Bytes
  ) {}

  public toStruct(): Struct {
    return new Struct([
      { key: 'type', value: Bytes.fromString(this._type) },
      { key: 'tokenContractAddress', value: this._tokenContractAddress },
      {
        key: 'range',
        value: this._range.toStruct()
      },
      {
        key: 'counterParty',
        value: this._counterParty
      },
      {
        key: 'blockNumber',
        value: this._blockNumber
      },
      {
        key: 'chunkId',
        value: this._chunkId
      }
    ])
  }

  public static getParamTypes(): Struct {
    return new Struct([
      { key: 'type', value: Bytes.default() },
      { key: 'tokenContractAddress', value: Address.default() },
      {
        key: 'range',
        value: Range.getParamType()
      },
      {
        key: 'counterParty',
        value: Address.default()
      },
      {
        key: 'blockNumber',
        value: BigNumber.default()
      },
      {
        key: 'chunkId',
        value: Bytes.default()
      }
    ])
  }

  public static fromStruct(struct: Struct): UserAction {
    const type = ActionType[(struct.data[0].value as Bytes).intoString()]
    const tokenAddress = struct.data[1].value as Address
    const range = struct.data[2].value as Struct
    const counterParty = struct.data[3].value as Address
    const blockNumber = struct.data[4].value as BigNumber
    const chunkId = struct.data[5].value as Bytes
    return new UserAction(
      type,
      tokenAddress,
      Range.fromStruct(range),
      counterParty,
      blockNumber,
      chunkId
    )
  }

  public get type(): string {
    return this._type
  }

  public get tokenAddress(): string {
    return this._tokenContractAddress.data
  }

  public get amount(): JSBI {
    return JSBI.subtract(this._range.end.data, this._range.start.data)
  }

  public get counterParty(): string {
    return this._counterParty.data
  }

  public get blockNumber(): JSBI {
    return this._blockNumber.data
  }

  public get chunkId(): string {
    return this._chunkId.toHexString()
  }

  public get range(): { start: string; end: string } {
    return {
      start: this._range.start.raw,
      end: this._range.end.raw
    }
  }
}
