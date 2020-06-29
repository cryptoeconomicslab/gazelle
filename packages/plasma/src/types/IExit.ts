import { Bytes, Range, Property } from '@cryptoeconomicslab/primitives'
import { StateUpdate } from './'

/**
 * @name IExit
 * @description Interface of Exit. You can finalize exit with finalizeExit method.
 */
export default interface IExit {
  readonly stateUpdate: StateUpdate
  readonly id: Bytes
  readonly range: Range
  readonly property: Property
}
