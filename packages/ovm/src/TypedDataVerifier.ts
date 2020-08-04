import { Transaction, UnsignedTransaction } from '@cryptoeconomicslab/plasma'
import JSBI from 'jsbi'
import { CompiledPredicate } from '@cryptoeconomicslab/ovm-transpiler'
import { recoverTypedSignatureLegacy } from 'eth-sig-util'
import {
  BigNumber,
  Bytes,
  Property,
  Address
} from '@cryptoeconomicslab/primitives'
import { DeciderConfig } from './load'
import { decodeStructable } from '@cryptoeconomicslab/coder'

/**
 * EIP712TypedData
 * https://github.com/ethereum/EIPs/blob/master/EIPS/eip-712.md
 */
export interface EIP712TypedData {
  name: string
  type: string
  value: any
}

function createTransactionParams(
  transaction: Transaction,
  transactionMessage: Bytes,
  stateObjectParams: any
): EIP712TypedData[] {
  const msgParams = [
    {
      type: 'address',
      name: 'token',
      value: transaction.depositContractAddress.data
    },
    {
      type: 'uint256',
      name: 'amount',
      value: JSBI.subtract(
        transaction.range.end.data,
        transaction.range.start.data
      ).toString()
    }
  ]
  const txBodyParam = {
    type: 'bytes',
    name: 'transaction',
    value: transactionMessage.toHexString()
  }
  return msgParams.concat(stateObjectParams).concat([txBodyParam])
}

function createStateObjectParams(
  stateObject: Property,
  compiledPredicate: CompiledPredicate
): EIP712TypedData[] {
  function getTypeString(type: string): string {
    const map = {
      Address: 'address',
      Bytes: 'bytes',
      BigNumber: 'uint256'
    }
    return map[type]
  }
  function getString(type: string, value: Bytes) {
    switch (type) {
      case 'Address':
        return ovmContext.coder.decode(Address.default(), value).data
      case 'Bytes':
        return ovmContext.coder.decode(Bytes.default(), value).toHexString()
      case 'BigNumber':
        return ovmContext.coder.decode(BigNumber.default(), value).toHexString()
      default:
        throw new Error('unknown type')
    }
  }
  const inputDefs = compiledPredicate.inputDefs.slice(
    0,
    compiledPredicate.inputDefs.length - 1
  )
  if (inputDefs.length !== stateObject.inputs.length) {
    throw new Error('incorrect inputs size')
  }
  return inputDefs.map((inputDef, i) => {
    return {
      type: getTypeString(inputDef.type),
      name: inputDef.name,
      value: getString(inputDef.type, stateObject.inputs[i])
    }
  })
}

function getPredicate(address: Address, config: DeciderConfig) {
  for (const key in config.deployedPredicateTable) {
    if (
      Address.from(config.deployedPredicateTable[key].deployedAddress).equals(
        address
      )
    ) {
      return config.deployedPredicateTable[key].source[0]
    }
  }
}

export function createTypedParams(
  config: DeciderConfig,
  transactionMessage: Bytes
): EIP712TypedData[] {
  const transaction = decodeStructable(
    UnsignedTransaction,
    ovmContext.coder,
    transactionMessage
  )
  const compiledPredicate = getPredicate(
    transaction.stateObject.deciderAddress,
    config
  )
  if (!compiledPredicate) {
    throw new Error(
      `createTypedParams failed because compiledPredicate of ${transaction.stateObject.deciderAddress} was not found.`
    )
  }
  const stateObjectHash = createStateObjectParams(
    transaction.stateObject,
    compiledPredicate
  )
  return createTransactionParams(
    transaction,
    transactionMessage,
    stateObjectHash
  )
}

/**
 * @name verifyTypedDataSignature
 * @description verify signature for EIP712 TypedData
 * @param manager DeciderManager
 * @param transactionMessage transaction message encoded unsigned transaction
 * @param signature signature
 * @param pubkey address of signer
 */
export async function verifyTypedDataSignature(
  config: DeciderConfig,
  transactionMessage: Bytes,
  signature: Bytes,
  pubkey: Bytes
): Promise<boolean> {
  const params = createTypedParams(config, transactionMessage)
  const address = ovmContext.coder.decode(Address.default(), pubkey)

  const recovered = recoverTypedSignatureLegacy({
    data: params,
    sig: signature.toHexString()
  }).toLowerCase()

  return address.data === recovered
}
