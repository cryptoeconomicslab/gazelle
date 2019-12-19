import { Bytes } from '../../src/types/Codables'
import { InMemoryKeyValueStore, RangeDb } from '../../src/db'
import getWitnesses, {
  isHint,
  replaceHint
} from '../../src/ovm/deciders/getWitnesses'

describe('get witnesses', () => {
  let db: InMemoryKeyValueStore
  beforeEach(async () => {
    db = new InMemoryKeyValueStore(Bytes.fromString('test'))
  })

  test('isHint', () => {
    expect(isHint(Bytes.fromString('b,KEY,v'))).toBeTruthy()
    expect(isHint(Bytes.fromString('b,RANGE,(10 20)'))).toBeTruthy()
  })

  test('isHint fail', () => {
    expect(isHint(Bytes.fromString('b,v'))).toBeFalsy()
  })

  test('getWitness', async () => {
    const bucket = await db.bucket(Bytes.fromString('bucket1'))
    const k = Bytes.fromString('k')
    const v = Bytes.fromString('v')
    await bucket.put(k, v)

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
    await bucket2.put(k, v)

    const hint = 'bucket1.bucket2,KEY,0x6b'
    const result = await getWitnesses(db, hint)
    expect(result.length).toBe(1)
    expect(result[0]).toStrictEqual(v)
  })

  test('getWitness range succeed', async () => {
    const rangeDb = new RangeDb(db)
    const bukcet = await rangeDb.bucket(Bytes.fromString('bucket5'))
    await bukcet.put(BigInt(15), BigInt(20), Bytes.fromString('v'))

    // 0x5b223235222c223135225d is Range(15, 20)
    const hint = 'bucket5,RANGE,0x5b223235222c223135225d'
    const result = await getWitnesses(db, hint)
    expect(result.length).toBe(1)
    expect(result[0]).toStrictEqual(Bytes.fromString('v'))
  })

  test('getWitness range', async () => {
    const rangeDb = new RangeDb(db)
    const bukcet = await rangeDb.bucket(Bytes.fromString('bucket'))
    await bukcet.put(BigInt(15), BigInt(20), Bytes.fromString('v'))

    const hint = 'bucket,RANGE,0x5b223235222c223135225d'
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
    const hint = 'range,NUMBER,0x1000000-0x1000010'
    const result = await getWitnesses(db, hint)
    expect(result.length).toBe(16)
    expect(result[0]).toStrictEqual(
      Bytes.fromString(JSON.stringify('16777216'))
    )
    expect(result[15]).toStrictEqual(
      Bytes.fromString(JSON.stringify('16777231'))
    )
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
  })
})
