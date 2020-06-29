import { Address, Bytes, Property } from '@cryptoeconomicslab/primitives'
import { decodeProperty } from '../helpers'

export interface IPropertyFilter {
  match: (property: Property) => boolean
}

export default class PropertyFilter {
  constructor(
    readonly address: Address,
    readonly inputs: Array<Bytes | undefined>,
    readonly child?: PropertyFilter,
    readonly children?: Array<PropertyFilter | undefined>
  ) {}

  private matchInputs(inputs: Bytes[]): boolean {
    if (this.inputs.length > inputs.length) return false

    return (
      this.inputs.length > inputs.length ||
      this.inputs
        .map(
          (input, i) =>
            input === undefined ||
            input.toHexString() === inputs[i].toHexString()
        )
        .every(result => result)
    )
  }

  private matchChild(property: Property): boolean {
    return !this.child || this.child.match(property)
  }

  private matchChildren(inputs: Bytes[]): boolean {
    if (!this.children) return true
    if (this.children.length > inputs.length) return false

    return this.children
      .map((child, i) => {
        if (!child) return true
        try {
          const property = decodeProperty(ovmContext.coder, inputs[i])
          return child.match(property)
        } catch (e) {
          return false
        }
      })
      .every(result => result)
  }

  public match(property: Property): boolean {
    let matchChild = true
    if (this.child) {
      try {
        matchChild = this.matchChild(
          decodeProperty(ovmContext.coder, property.inputs[0])
        )
      } catch (e) {
        matchChild = false
      }
    }

    let matchChildren = true
    if (this.children) {
      matchChildren = this.matchChildren(property.inputs)
    }

    return (
      property.deciderAddress.data === this.address.data &&
      this.matchInputs(property.inputs) &&
      matchChild &&
      matchChildren
    )
  }
}
