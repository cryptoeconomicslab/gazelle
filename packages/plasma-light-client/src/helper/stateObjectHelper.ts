import { Property, Bytes } from '@cryptoeconomicslab/primitives'

/**
 *
 * @param stateObject stateObject to concat witness with
 * @param witness witness to concat
 */
export function mergeWitness(
  stateObject: Property,
  witness: Bytes[]
): Property {
  return new Property(
    stateObject.deciderAddress,
    stateObject.inputs.concat(witness)
  )
}
