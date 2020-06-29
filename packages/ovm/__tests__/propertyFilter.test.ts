import { PropertyFilterBuilder } from '../src/propertyFilter'
import { Address, Bytes, Property } from '@cryptoeconomicslab/primitives'
import JsonCoder from '@cryptoeconomicslab/coder'
import { setupContext } from '@cryptoeconomicslab/context'
import { encodeProperty } from '../src/helpers'
setupContext({ coder: JsonCoder })

const ADDRESS1 = Address.from('0x00000000000000000000')
const ADDRESS2 = Address.from('0x00000000000000000001')
const ADDRESS3 = Address.from('0x00000000000000000002')

describe('PropertyFilter', () => {
  const property = new Property(ADDRESS1, [
    JsonCoder.encode(ADDRESS1),
    JsonCoder.encode(ADDRESS2)
  ])

  const nestedProperty = new Property(ADDRESS1, [
    encodeProperty(ovmContext.coder, new Property(ADDRESS2, []))
  ])

  const invalidNestedProperty = new Property(ADDRESS1, [Bytes.default()])

  const propertyHavingChildren = new Property(ADDRESS1, [
    encodeProperty(ovmContext.coder, new Property(ADDRESS2, [])),
    encodeProperty(ovmContext.coder, new Property(ADDRESS3, []))
  ])

  const propertyHavingInvalidChildren = new Property(ADDRESS1, [
    Bytes.default(),
    encodeProperty(ovmContext.coder, new Property(ADDRESS3, []))
  ])

  test('throw when no address specified for builder', () => {
    expect(new PropertyFilterBuilder().build).toThrow()
  })

  test('match with property', () => {
    const filter = new PropertyFilterBuilder().address(ADDRESS1).build()
    expect(filter.match(property)).toBeTruthy()
  })

  test('do not match with property', () => {
    const filter = new PropertyFilterBuilder().address(ADDRESS2).build()
    expect(filter.match(property)).toBeFalsy()
  })

  test('match with  property when specifying all inputs', () => {
    const filter = new PropertyFilterBuilder()
      .address(ADDRESS1)
      .inputs([JsonCoder.encode(ADDRESS1), JsonCoder.encode(ADDRESS2)])
      .build()
    expect(filter.match(property)).toBeTruthy()
  })

  test('match with property when specifying part of its inputs', () => {
    const filter = new PropertyFilterBuilder()
      .address(ADDRESS1)
      .inputs([undefined, JsonCoder.encode(ADDRESS2)])
      .build()
    expect(filter.match(property)).toBeTruthy()
  })

  test('do not match with  property when specifying inputs', () => {
    const filter = new PropertyFilterBuilder()
      .address(ADDRESS1)
      .inputs([undefined, JsonCoder.encode(ADDRESS1)])
      .build()
    expect(filter.match(property)).toBeFalsy()
  })

  test('match with nested property', () => {
    const filter = new PropertyFilterBuilder()
      .address(ADDRESS1)
      .child(new PropertyFilterBuilder().address(ADDRESS2).build())
      .build()
    expect(filter.match(nestedProperty)).toBeTruthy()
  })

  test('do not match with nested property', () => {
    const filter = new PropertyFilterBuilder()
      .address(ADDRESS1)
      .child(new PropertyFilterBuilder().address(ADDRESS3).build())
      .build()
    expect(filter.match(nestedProperty)).toBeFalsy()
  })

  test('do not match with nested property with invalid child property', () => {
    const filter = new PropertyFilterBuilder()
      .address(ADDRESS1)
      .child(new PropertyFilterBuilder().address(ADDRESS3).build())
      .build()
    expect(filter.match(invalidNestedProperty)).toBeFalsy()
  })

  test('match children', () => {
    const filter = new PropertyFilterBuilder()
      .address(ADDRESS1)
      .children([
        new PropertyFilterBuilder().address(ADDRESS2).build(),
        new PropertyFilterBuilder().address(ADDRESS3).build()
      ])
      .build()
    expect(filter.match(propertyHavingChildren)).toBeTruthy()
  })

  test('match with property with part of children', () => {
    const filter = new PropertyFilterBuilder()
      .address(ADDRESS1)
      .children([new PropertyFilterBuilder().address(ADDRESS2).build()])
      .build()
    expect(filter.match(propertyHavingChildren)).toBeTruthy()
  })

  test('match with property with part of children with undefined child', () => {
    const filter = new PropertyFilterBuilder()
      .address(ADDRESS1)
      .children([
        undefined,
        new PropertyFilterBuilder().address(ADDRESS3).build()
      ])
      .build()
    expect(filter.match(propertyHavingChildren)).toBeTruthy()
  })

  test('do not match with children over length', () => {
    const filter = new PropertyFilterBuilder()
      .address(ADDRESS1)
      .children([
        new PropertyFilterBuilder().address(ADDRESS2).build(),
        new PropertyFilterBuilder().address(ADDRESS3).build(),
        new PropertyFilterBuilder().address(ADDRESS3).build()
      ])
      .build()
    expect(filter.match(propertyHavingChildren)).toBeFalsy()
  })

  test('do not match with children', () => {
    const filter = new PropertyFilterBuilder()
      .address(ADDRESS1)
      .children([
        new PropertyFilterBuilder().address(ADDRESS1).build(),
        new PropertyFilterBuilder().address(ADDRESS3).build()
      ])
      .build()
    expect(filter.match(propertyHavingChildren)).toBeFalsy()
  })

  test('do not match with property with invalid children properties', () => {
    const filter = new PropertyFilterBuilder()
      .address(ADDRESS1)
      .children([
        new PropertyFilterBuilder().address(ADDRESS2).build(),
        new PropertyFilterBuilder().address(ADDRESS3).build()
      ])
      .build()
    expect(filter.match(propertyHavingInvalidChildren)).toBeFalsy()
  })
})
