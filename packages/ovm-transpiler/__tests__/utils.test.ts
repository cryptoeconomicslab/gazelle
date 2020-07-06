import { PropertyDef } from '@cryptoeconomicslab/ovm-parser'
import { isLibrary } from '../src/utils'

describe('utils', () => {
  beforeEach(async () => {})
  describe('isLibrary', () => {
    test('is library', () => {
      const library: PropertyDef = {
        annotations: [
          {
            type: 'Annotation',
            body: {
              name: 'library',
              args: []
            }
          }
        ],
        name: 'SignedBy',
        inputDefs: [{ name: 'a', type: 'Bytes' }],
        body: {
          type: 'PropertyNode',
          predicate: 'Foo',
          inputs: ['a']
        }
      }
      expect(isLibrary(library)).toBeTruthy()
    })

    test('is not library', () => {
      const library: PropertyDef = {
        annotations: [
          {
            type: 'Annotation',
            body: {
              name: 'quantifier',
              args: []
            }
          }
        ],
        name: 'SignedBy',
        inputDefs: [{ name: 'a', type: 'Bytes' }],
        body: {
          type: 'PropertyNode',
          predicate: 'Foo',
          inputs: ['a']
        }
      }
      expect(isLibrary(library)).toBeFalsy()
    })
  })
})
