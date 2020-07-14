import { KeyValueStore } from '@cryptoeconomicslab/db'
import { Bytes } from '@cryptoeconomicslab/primitives'

export async function getStorageDb(witnessDb: KeyValueStore) {
  const bucket = await witnessDb.bucket(Bytes.fromString('STORAGE'))
  return bucket
}
