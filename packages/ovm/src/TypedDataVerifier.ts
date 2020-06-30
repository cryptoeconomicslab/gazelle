import { Transaction } from '@cryptoeconomicslab/plasma'
import JSBI from 'jsbi'
import { CompiledPredicate } from '@cryptoeconomicslab/ovm-transpiler'
import { recoverTypedSignatureLegacy } from 'eth-sig-util'
import { DeciderManager } from './DeciderManager'
import {
  BigNumber,
  Bytes,
  Property,
  Address
} from '@cryptoeconomicslab/primitives'

/**
 * EIP712TypedData
 * https://github.com/ethereum/EIPs/blob/master/EIPS/eip-712.md
 */
interface EIP712TypedData {
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
  return inputDefs.map((inputDef, i) => {
    return {
      type: getTypeString(inputDef.type),
      name: inputDef.name,
      value: getString(inputDef.type, stateObject.inputs[i])
    }
  })
}

/**
 * @name verifyTypedDataSignature
 * @description verify signature for EIP712 TypedData
 * @param manager DeciderManager
 * @param transactionMessage transaction message
 * @param signature signature
 * @param pubkey address of signer
 */
export async function verifyTypedDataSignature(
  manager: DeciderManager,
  transactionMessage: Bytes,
  signature: Bytes,
  pubkey: Bytes
): Promise<boolean> {
  const property = Property.fromStruct(
    ovmContext.coder.decode(Property.getParamType(), transactionMessage)
  )
  const transaction = Transaction.fromProperty(property)
  const compiledPredicate = manager.getCompiledPredicateByAddress(
    transaction.stateObject.deciderAddress
  )
  if (!compiledPredicate) return false
  const stateObjectHash = createStateObjectParams(
    transaction.stateObject,
    compiledPredicate.compiled
  )
  const params = createTransactionParams(
    transaction,
    transactionMessage,
    stateObjectHash
  )
  const address = ovmContext.coder.decode(Address.default(), pubkey)
  return (
    address.data ===
    recoverTypedSignatureLegacy({
      data: params,
      sig: signature.toHexString()
    }).toLowerCase()
  )
}
