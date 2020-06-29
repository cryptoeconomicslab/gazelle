import {
  Bytes,
  Address,
  BigNumber,
  Property
} from '@cryptoeconomicslab/primitives'
import { Decider } from '../../interfaces/Decider'
import { Decision } from '../../types'
import { DeciderManager } from '../../DeciderManager'
import { getSignatureVerifier } from '@cryptoeconomicslab/signature'
import { Transaction } from '@cryptoeconomicslab/plasma'
import { Keccak256 } from '@cryptoeconomicslab/hash'
import JSBI from '@cryptoeconomicslab/primitives/node_modules/jsbi'

const SECP256K1 = 'secp256k1'

function hashTransaction(
  transaction: Transaction,
  transactionMessage: Bytes
): Bytes {
  return Bytes.concat([
    Keccak256.hash(
      Bytes.concat([
        Keccak256.hash(Bytes.fromString('address token')),
        Keccak256.hash(
          Bytes.fromHexString(transaction.depositContractAddress.data)
        )
      ])
    ),
    Keccak256.hash(
      Bytes.concat([
        Keccak256.hash(Bytes.fromString('uint256 amount')),
        Keccak256.hash(
          ovmContext.coder.encode(
            BigNumber.from(
              JSBI.subtract(
                transaction.range.end.data,
                transaction.range.start.data
              )
            )
          )
        )
      ])
    ),
    hashStateObject(transaction.stateObject),
    Keccak256.hash(
      Bytes.concat([
        Keccak256.hash(Bytes.fromString('bytes transaction')),
        Keccak256.hash(transactionMessage)
      ])
    )
  ])
}

function hashStateObject(stateObject: Property): Bytes {
  return Keccak256.hash(
    Bytes.concat([
      Keccak256.hash(Bytes.fromString('address owner')),
      Keccak256.hash(
        Bytes.fromHexString(
          ovmContext.coder.decode(Address.default(), stateObject.inputs[0]).data
        )
      )
    ])
  )
}

async function verifyTypedDataSignature(
  transactionMessage: Bytes,
  signature: Bytes,
  pubkey: Bytes
): Promise<boolean> {
  const property = Property.fromStruct(
    ovmContext.coder.decode(Property.getParamType(), transactionMessage)
  )
  const transaction = Transaction.fromProperty(property)
  const hash = hashTransaction(transaction, transactionMessage)
  const verifier = getSignatureVerifier(SECP256K1)
  try {
    return await verifier.verify(hash, signature, pubkey)
  } catch (e) {
    return false
  }
}

/**
 * IsHashPreimageDecider decide if given message is validly signed with given publicKey
 * with given signature algorithm.
 * inputs: Array<Bytes> [message, signature, publicKey, algorithm]
 */
export class IsValidSignatureDecider implements Decider {
  public async decide(
    _manager: DeciderManager,
    inputs: Bytes[]
  ): Promise<Decision> {
    if (inputs.length !== 4) {
      return {
        outcome: false,
        challenge: null
      }
    }

    const [message, signature, publicKey, verifierKey] = inputs
    let result
    if (verifierKey.intoString() === 'typedData') {
      result = verifyTypedDataSignature(message, signature, publicKey)
    } else {
      const verifier = getSignatureVerifier(verifierKey.intoString())
      const pubkey = Bytes.fromHexString(
        ovmContext.coder.decode(Address.default(), publicKey).data
      )

      try {
        result = await verifier.verify(message, signature, pubkey)
      } catch (e) {
        result = false
      }
    }

    return {
      outcome: result,
      challenge: null
    }
  }
}
