import { Bytes, BigNumber, Range } from '@cryptoeconomicslab/primitives'
import { InMemoryKeyValueStore } from '@cryptoeconomicslab/level-kvs'
import {
  getWitnesses,
  putWitness,
  isHint,
  replaceHint,
  RangeDb,
  KeyValueStore
} from '../src'
import { Keccak256 } from '@cryptoeconomicslab/hash'
import Coder from '@cryptoeconomicslab/coder'
import { setupContext } from '@cryptoeconomicslab/context'
import JSBI from 'jsbi'
setupContext({ coder: Coder })

describe('witness', () => {
  describe('hint', () => {
    test('isHint', () => {
      expect(isHint(Bytes.fromString('b,KEY,v'))).toBeTruthy()
      expect(isHint(Bytes.fromString('b,RANGE,(10 20)'))).toBeTruthy()
    })

    test('isHint fail', () => {
      expect(isHint(Bytes.fromString('b,v'))).toBeFalsy()
    })
  })

  describe('put witnesses', () => {
    let db: InMemoryKeyValueStore
    beforeEach(async () => {
      db = new InMemoryKeyValueStore(Bytes.fromString('test'))
    })

    test('put witness', async () => {
      const hint = 'bucket1.bucket2,KEY,0x6b'
      await putWitness(db, hint, Bytes.fromHexString('0x01'))
      const bucket: KeyValueStore = await (
        await db.bucket(Bytes.fromString('bucket1'))
      ).bucket(Bytes.fromString('bucket2'))
      const actual = await bucket.get(
        Keccak256.hash(Bytes.fromHexString('0x6b'))
      )
      expect(actual).toEqual(Bytes.fromHexString('0x01'))
    })
  })

  describe('get witnesses', () => {
    let db: InMemoryKeyValueStore
    beforeEach(async () => {
      db = new InMemoryKeyValueStore(Bytes.fromString('test'))
    })

    test('getWitness', async () => {
      const bucket = await db.bucket(Bytes.fromString('bucket1'))
      const k = Bytes.fromString('k')
      const v = Bytes.fromString('v')
      await bucket.put(Keccak256.hash(k), v)

      // 0x6b is k
      const hint = 'bucket1,KEY,0x6b'
      const result = await getWitnesses(db, hint)
      expect(result.length).toBe(1)
      expect(result[0]).toStrictEqual(v)
    })

    test('getWitness nested', async () => {
      const bucket = await db.bucket(Bytes.fromString('bucket1'))
      const bucket2 = await bucket.bucket(Bytes.fromString('bucket2'))
      const k = Bytes.fromString('k')
      const v = Bytes.fromString('v')
      await bucket2.put(Keccak256.hash(k), v)

      const hint = 'bucket1.bucket2,KEY,0x6b'
      const result = await getWitnesses(db, hint)
      expect(result.length).toBe(1)
      expect(result[0]).toStrictEqual(v)
    })

    test('getWitness range succeed', async () => {
      const rangeDb = new RangeDb(db)
      const bukcet = await rangeDb.bucket(Bytes.fromString('bucket5'))
      await bukcet.put(JSBI.BigInt(15), JSBI.BigInt(20), Bytes.fromString('v'))

      // 0x5b223235222c223135225d is Range(15, 20)
      const hint =
        'bucket5,RANGE,' +
        ovmContext.coder
          .encode(new Range(BigNumber.from(15), BigNumber.from(20)).toStruct())
          .toHexString()
      const result = await getWitnesses(db, hint)
      expect(result.length).toBe(1)
      expect(result[0]).toStrictEqual(Bytes.fromString('v'))
    })

    test('getWitness range', async () => {
      const rangeDb = new RangeDb(db)
      const bukcet = await rangeDb.bucket(Bytes.fromString('bucket'))
      await bukcet.put(JSBI.BigInt(15), JSBI.BigInt(20), Bytes.fromString('v'))

      const hint =
        'bucket,RANGE,' +
        ovmContext.coder
          .encode(new Range(BigNumber.from(15), BigNumber.from(20)).toStruct())
          .toHexString()
      const result = await getWitnesses(db, hint)
      expect(result.length).toBe(1)
      expect(result[0]).toStrictEqual(Bytes.fromString('v'))
    })

    test('getWitness iter', async () => {
      const bucket = await db.bucket(Bytes.fromString('bucket'))
      for (let i = 0; i < 3; i++) {
        const k = Bytes.fromString(`k${i}`)
        const v = Bytes.fromString(`v${i}`)
        await bucket.put(k, v)
      }

      const hint = 'bucket,ITER,0x6b'
      const result = await getWitnesses(db, hint)
      expect(result.length).toBe(3)
      expect(result[0]).toStrictEqual(Bytes.fromString('v0'))
    })

    test('getWitness number range', async () => {
      const hint = 'range,NUMBER,0x22313022-0x22323622'
      const result = await getWitnesses(db, hint)
      expect(result.length).toBe(16)
      expect(result[0]).toStrictEqual(Bytes.fromHexString('0x22313022'))
      expect(result[15]).toStrictEqual(Bytes.fromHexString('0x22323522'))
    })

    test('throw exception unknown type', async () => {
      const hint = 'range,UNKNOWN,0x10'
      expect(getWitnesses(db, hint)).rejects.toThrowError(
        'UNKNOWN is unknown type of hint.'
      )
    })

    describe('replaceHint', () => {
      test('replace no vars', async () => {
        expect(replaceHint('a,b,c', {})).toEqual('a,b,c')
      })

      test('replace vars', async () => {
        expect(
          replaceHint('a,b.${g}.c,${d}', {
            d: Bytes.fromString('ddd'),
            g: Bytes.fromString('ggg')
          })
        ).toEqual('a,b.0x676767.c,0x646464')
      })

      test('replace vars with dot', async () => {
        expect(
          replaceHint('a,b,${a.0}', {
            'a.0': Bytes.fromString('aaa')
          })
        ).toEqual('a,b,0x616161')
      })

      test('replace constants', async () => {
        expect(
          replaceHint('a,b,${$constant}', {
            $constant: Bytes.fromString('aaa')
          })
        ).toEqual('a,b,0x616161')
      })
    })
  })
})
