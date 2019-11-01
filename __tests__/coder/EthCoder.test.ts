import EthCoder, { getEthParamType } from '../../src/coder/EthCoder'
import {
  Address,
  Bytes,
  Integer,
  List,
  Tuple,
  Struct
} from '../../src/types/Codables'

describe('EthCoder', () => {
  describe('encode', () => {
    test('encode struct', () => {
      const struct = Struct.from({
        num: Integer.from(5),
        addr: Address.from('0x0472ec0185ebb8202f3d4ddb0226998889663cf2'),
        greet: Bytes.fromString('hello')
      })

      expect(EthCoder.encode(struct)).toBe(
        '0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000472ec0185ebb8202f3d4ddb0226998889663cf200000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000005000000000000000000000000000000000000000000000000000000000000000568656c6c6f000000000000000000000000000000000000000000000000000000'
      )
    })

    test('encode tuple', () => {
      const tuple = Tuple.from([
        Integer.from(5),
        Address.from('0x0472ec0185ebb8202f3d4ddb0226998889663cf2'),
        Bytes.fromString('hello')
      ])

      expect(EthCoder.encode(tuple)).toBe(
        '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000050000000000000000000000000472ec0185ebb8202f3d4ddb0226998889663cf20000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000568656c6c6f000000000000000000000000000000000000000000000000000000'
      )
    })

    test('encode empty list', () => {
      const list = List.from(Bytes, [])

      EthCoder.encode(list)
    })

    test('encode list of struct', () => {
      const factory = {
        default: () =>
          Struct.from({
            num: Integer.default(),
            greet: Bytes.default()
          })
      }

      const list = List.from(factory, [
        Struct.from({
          num: Integer.from(1),
          greet: Bytes.fromString('hello')
        }),
        Struct.from({
          num: Integer.from(2),
          greet: Bytes.fromString('hello')
        })
      ])

      expect(EthCoder.encode(list)).toBe(
        '0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000568656c6c6f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000568656c6c6f000000000000000000000000000000000000000000000000000000'
      )
    })
  })

  describe('decode', () => {
    test('decode struct', () => {
      const b =
        '0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000472ec0185ebb8202f3d4ddb0226998889663cf200000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000005000000000000000000000000000000000000000000000000000000000000000568656c6c6f000000000000000000000000000000000000000000000000000000'
      const t = Struct.from({
        addr: Address.default(),
        greet: Bytes.default(),
        num: Integer.default()
      })

      expect(EthCoder.decode(t, b)).toStrictEqual(
        Struct.from({
          num: Integer.from(5),
          addr: Address.from('0x0472ec0185ebb8202f3d4ddb0226998889663cf2'),
          greet: Bytes.from(new Uint8Array([104, 101, 108, 108, 111]))
        })
      )
    })

    test('decode tuple', () => {
      const b =
        '0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000472ec0185ebb8202f3d4ddb0226998889663cf200000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000005000000000000000000000000000000000000000000000000000000000000000568656c6c6f000000000000000000000000000000000000000000000000000000'
      const t = Tuple.from([
        Address.default(),
        Bytes.default(),
        Integer.default()
      ])

      expect(EthCoder.decode(t, b)).toStrictEqual(
        Tuple.from([
          Address.from('0x0472ec0185ebb8202f3d4ddb0226998889663cf2'),
          Bytes.fromString('hello'),
          Integer.from(5)
        ])
      )
    })

    test('decode List', () => {
      const b =
        '0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000003'
      const t = List.default(Integer, Integer.default())
      expect(EthCoder.decode(t, b)).toStrictEqual(
        List.from(Integer, [Integer.from(1), Integer.from(2), Integer.from(3)])
      )
    })

    test('decode List of Struct', () => {
      const factory = {
        default: () =>
          Struct.from({
            num: Integer.default(),
            greet: Bytes.default()
          })
      }
      const b =
        '0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000568656c6c6f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000568656c6c6f000000000000000000000000000000000000000000000000000000'
      const t = List.default(
        factory,
        Struct.from({
          num: Integer.default(),
          greet: Bytes.default()
        })
      )

      expect(EthCoder.decode(t, b)).toStrictEqual(
        List.from(factory, [
          Struct.from({
            num: Integer.from(1),
            greet: Bytes.fromString('hello')
          }),
          Struct.from({
            num: Integer.from(2),
            greet: Bytes.fromString('hello')
          })
        ])
      )
    })
  })

  describe('getEthParamType()', () => {
    test('getEthParamType for Tuple', () => {
      const tuple = Tuple.from([
        Integer.default(),
        Address.default(),
        Bytes.default()
      ])

      expect(getEthParamType(tuple)).toStrictEqual({
        type: 'tuple',
        components: [
          { type: 'uint256', name: '0' },
          { type: 'address', name: '1' },
          { type: 'bytes', name: '2' }
        ]
      })
    })

    test('getEthParamType for nested Tuple', () => {
      const tuple = Tuple.from([
        Tuple.from([Integer.default()]),
        Integer.default(),
        Address.default(),
        Bytes.default()
      ])

      expect(getEthParamType(tuple)).toStrictEqual({
        type: 'tuple',
        components: [
          {
            type: 'tuple',
            name: '0',
            components: [{ type: 'uint256', name: '0' }]
          },
          { type: 'uint256', name: '1' },
          { type: 'address', name: '2' },
          { type: 'bytes', name: '3' }
        ]
      })
    })

    test('getEthParamType for Struct', () => {
      const struct = Struct.from({
        num: Integer.default(),
        addr: Address.default(),
        greet: Bytes.default()
      })

      expect(getEthParamType(struct)).toStrictEqual({
        type: 'tuple',
        components: [
          { type: 'address', name: 'addr' },
          { type: 'bytes', name: 'greet' },
          { type: 'uint256', name: 'num' }
        ]
      })
    })

    test('getEthParamType for nested Struct', () => {
      const struct = Struct.from({
        from: Struct.from({
          addr: Address.default()
        }),
        num: Integer.default(),
        addr: Address.default(),
        greet: Bytes.default()
      })

      expect(getEthParamType(struct)).toStrictEqual({
        type: 'tuple',
        components: [
          { type: 'address', name: 'addr' },
          {
            type: 'tuple',
            name: 'from',
            components: [
              {
                type: 'address',
                name: 'addr'
              }
            ]
          },
          { type: 'bytes', name: 'greet' },
          { type: 'uint256', name: 'num' }
        ]
      })
    })
  })
})
