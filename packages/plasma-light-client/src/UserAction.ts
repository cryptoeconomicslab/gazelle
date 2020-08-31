import {
  BigNumber,
  Bytes,
  Range,
  Struct,
  Address,
  FixedBytes,
  List
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
  ranges: Range[],
  blockNumber: BigNumber,
  chunkId: FixedBytes
): UserAction {
  return new UserAction(
    ActionType.Deposit,
    tokenAddress,
    ranges,
    Address.default(),
    blockNumber,
    chunkId
  )
}

export function createExitUserAction(
  tokenAddress: Address,
  ranges: Range[],
  blockNumber: BigNumber,
  chunkId: FixedBytes
): UserAction {
  return new UserAction(
    ActionType.Exit,
    tokenAddress,
    ranges,
    Address.default(),
    blockNumber,
    chunkId
  )
}

export function createSendUserAction(
  tokenAddress: Address,
  ranges: Range[],
  to: Address,
  blockNumber: BigNumber,
  chunkId: FixedBytes
): UserAction {
  return new UserAction(
    ActionType.Send,
    tokenAddress,
    ranges,
    to,
    blockNumber,
    chunkId
  )
}

export function createReceiveUserAction(
  tokenAddress: Address,
  ranges: Range[],
  from: Address,
  blockNumber: BigNumber,
  chunkId: FixedBytes
): UserAction {
  return new UserAction(
    ActionType.Receive,
    tokenAddress,
    ranges,
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
    private _ranges: Range[],
    private _counterParty: Address,
    private _blockNumber: BigNumber,
    private _chunkId: FixedBytes
  ) {}

  public toStruct(): Struct {
    return new Struct([
      { key: 'type', value: Bytes.fromString(this._type) },
      { key: 'tokenContractAddress', value: this._tokenContractAddress },
      {
        key: 'ranges',
        value: List.from(
          { default: () => Range.getParamType() },
          this._ranges.map(r => r.toStruct())
        )
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
        key: 'ranges',
        value: List.default(
          { default: () => Range.getParamType() },
          Range.getParamType()
        )
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
        value: FixedBytes.default(32)
      }
    ])
  }

  public static fromStruct(struct: Struct): UserAction {
    const type = ActionType[(struct.data[0].value as Bytes).intoString()]
    const tokenAddress = struct.data[1].value as Address
    const ranges = struct.data[2].value as List<Struct>
    const counterParty = struct.data[3].value as Address
    const blockNumber = struct.data[4].value as BigNumber
    const chunkId = struct.data[5].value as FixedBytes
    return new UserAction(
      type,
      tokenAddress,
      ranges.data.map(Range.fromStruct),
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
    return this._ranges.reduce(
      (prev, current) =>
        JSBI.add(prev, JSBI.subtract(current.end.data, current.start.data)),
      JSBI.BigInt(0)
    )
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

  public get ranges(): Array<{ start: string; end: string }> {
    return this._ranges.map(range => ({
      start: range.start.raw,
      end: range.end.raw
    }))
  }
}
