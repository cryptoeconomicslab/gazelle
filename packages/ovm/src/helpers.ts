import { Bytes, Property } from '@cryptoeconomicslab/primitives'
import { Coder } from '@cryptoeconomicslab/coder'

export const decodeProperty = (coder: Coder, input: Bytes) =>
  Property.fromStruct(coder.decode(Property.getParamType(), input))
export const encodeProperty = (coder: Coder, property: Property) =>
  coder.encode(property.toStruct())
