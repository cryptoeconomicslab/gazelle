import { Bytes } from '../types/Codables'

export class RangeRecord {
  public static decode(bytes: Bytes): RangeRecord {
    const obj = JSON.parse(bytes.intoString())
    return new RangeRecord(obj.start, obj.end, Bytes.fromString(obj.value))
  }
  public start: number
  public end: number
  public value: Bytes
  constructor(start: number, end: number, value: Bytes) {
    this.start = start
    this.end = end
    this.value = value
  }
  public encode(): Bytes {
    return Bytes.fromString(
      JSON.stringify({
        start: this.start,
        end: this.end,
        value: this.value.intoString()
      })
    )
  }
  public intersect(start: number, end: number): boolean {
    if (end <= start) {
      throw new Error('end must be greater than start.')
    }
    if (start < 0) {
      throw new Error('start must not be negative value.')
    }
    const maxStart = Math.max(this.start, start)
    const maxEnd = Math.min(this.end, end)
    return maxStart < maxEnd
  }
}

export interface RangeStore {
  get(start: number, end: number): Promise<RangeRecord[]>
  put(start: number, end: number, value: Bytes): Promise<void>
  del(start: number, end: number): Promise<void>
  bucket(key: Bytes): RangeStore
}
