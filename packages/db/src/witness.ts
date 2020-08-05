import { Bytes, BigNumber, Range } from '@cryptoeconomicslab/primitives'
import { BigIntMath } from '@cryptoeconomicslab/utils'
import { Keccak256 } from '@cryptoeconomicslab/hash'
import { KeyValueStore, RangeStore, RangeDb } from './'
import { decodeStructable } from '@cryptoeconomicslab/coder'
import JSBI from 'jsbi'

const TYPES = {
  key: 'KEY',
  iter: 'ITER',
  range: 'RANGE'
}

async function getBucketByHint(
  witnessDb: KeyValueStore,
  hint: string
): Promise<KeyValueStore | RangeStore> {
  if (!isHint(Bytes.fromString(hint))) throw new Error('Invalid hint string')

  const [bucket, type] = hint.split(',')
  const bucketNames = bucket.split('.')
  if (type === TYPES.key || type === TYPES.iter) {
    let db = witnessDb
    for (const b of bucketNames) {
      db = await db.bucket(Bytes.fromString(b))
    }
    return db
  } else if (type === TYPES.range) {
    let db: RangeStore = new RangeDb(witnessDb)
    for await (const b of bucketNames) {
      db = await db.bucket(Bytes.fromString(b))
    }
    return db
  }
  throw new Error(`could not get bucket with given hint string: ${hint}`)
}

/**
 * get witnesses from witness db using hint.
 * witness can be quantified by bucket name and single key or range.
 * bucket must be specified by bucket name. when bucket must be chained,
 * connect bucket name with dot s.t. bucket1.bucket2.bucket3
 * when using key, hint must be in following format
 * 'bucket,KEY,${hex string of key}'
 * when using range, hint must be in following format
 * 'bucket,RANGE,${hex string of encoded range}'
 * when quantify by iterator, hint must be in following format
 * 'bucket,KEY.ITER,${hex string of lower_bound}'
 * 'bucket,RANGE.ITER,(start end)'
 * when quantify numbers, hint must be in following format
 * 'range,NUMBER,${hex string of start}-${hex string of end}'
 * @param witnessDb key value store
 * @param hint hint string
 */
export async function getWitnesses(
  witnessDb: KeyValueStore,
  hint: string
): Promise<Bytes[]> {
  const [_, type, param] = hint.split(',')
  if (type === TYPES.key) {
    const db = await getBucketByHint(witnessDb, hint)
    const result = await (db as KeyValueStore).get(
      Keccak256.hash(Bytes.fromHexString(param))
    )
    return result === null ? [] : [result]
  } else if (type === TYPES.range) {
    const db = await getBucketByHint(witnessDb, hint)
    const range = decodeStructable(
      Range,
      ovmContext.coder,
      Bytes.fromHexString(param)
    )
    const result = await (db as RangeStore).get(
      range.start.data,
      range.end.data
    )
    return result.map(r => r.value)
  } else if (type === TYPES.iter) {
    const db = await getBucketByHint(witnessDb, hint)
    const iter = (db as KeyValueStore).iter(Bytes.fromHexString(param))
    const result: Bytes[] = []
    let next = await iter.next()
    while (next) {
      result.push(next.value)
      next = await iter.next()
    }
    return result
  } else if (type === 'NUMBER') {
    const [start, end] = param
      .split('-')
      .map(n =>
        ovmContext.coder.decode(BigNumber.default(), Bytes.fromHexString(n))
      )
    return BigIntMath.makeRange(
      start.data,
      JSBI.subtract(end.data, JSBI.BigInt(1))
    )
      .map(BigNumber.from)
      .map(ovmContext.coder.encode)
  } else {
    throw new Error(`${type} is unknown type of hint.`)
  }
}

/**
 * put witness into witnessDb based on given hint string
 * @param witnessDb witnessDb instance to put value in
 * @param hint hint string
 * @param value value to store
 */
export async function putWitness(
  witnessDb: KeyValueStore,
  hint: string,
  value: Bytes
): Promise<void> {
  const [_, type, param] = hint.split(',')
  const db = await getBucketByHint(witnessDb, hint)
  if (type === TYPES.key) {
    await (db as KeyValueStore).put(
      Keccak256.hash(Bytes.fromHexString(param)),
      value
    )
  } else if (type === TYPES.range) {
    const range = decodeStructable(
      Range,
      ovmContext.coder,
      Bytes.fromHexString(param)
    )
    await (db as RangeStore).put(range.start.data, range.end.data, value)
  } else {
    throw new Error('cannot execute put operation with given hint type')
  }
}

// check if b is hint string
export function isHint(b: Bytes): boolean {
  return b.intoString().split(',').length === 3
}

/**
 *
 * @param hint is template string like "aaa,${b},ccc"
 * @param substitutions is object which has variables to replace template string, e.g. {b: "bar"}
 */
export function replaceHint(
  hint: string,
  substitutions: { [key: string]: Bytes }
): string {
  return Object.keys(substitutions).reduce(
    (hint, key) => hint.replace(`\${${key}}`, substitutions[key].toHexString()),
    hint
  )
}
