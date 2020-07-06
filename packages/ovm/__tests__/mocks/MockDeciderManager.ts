import { Bytes, Address, Property } from '@cryptoeconomicslab/primitives'
import JsonCoder, { Coder } from '@cryptoeconomicslab/coder'
import {
  AtomicPredicate,
  DeciderManagerInterface,
  LogicalConnective,
  Decision
} from '../../src'
import { setupContext } from '@cryptoeconomicslab/context'
import { TraceInfoCreator } from '../../src/Tracer'
import { KeyValueStore } from '@cryptoeconomicslab/db'
import { InMemoryKeyValueStore } from '@cryptoeconomicslab/level-kvs'
setupContext({ coder: JsonCoder })

const BoolDeciderAddress = Address.from(
  '0x0000000000000000000000000000000000000001'
)
const NotDeciderAddress = Address.from(
  '0x0000000000000000000000000000000000000002'
)
const AndDeciderAddress = Address.from(
  '0x0000000000000000000000000000000000000003'
)
const ForAllSuchThatDeciderAddress = Address.from(
  '0x0000000000000000000000000000000000000004'
)
const OrDeciderAddress = Address.from(
  '0x0000000000000000000000000000000000000009'
)

export class MockDeciderManager implements DeciderManagerInterface {
  readonly coder: Coder = JsonCoder
  private db = new InMemoryKeyValueStore(Bytes.fromString('db'))
  public async decide(
    property: Property,
    substitutions: { [key: string]: Bytes } = {}
  ): Promise<Decision> {
    return {
      outcome:
        property.inputs.length > 0 &&
        property.inputs[0].intoString() === 'true',
      challenge: null,
      traceInfo: TraceInfoCreator.create('Bool', property.inputs)
    }
  }
  getDeciderAddress(operator: LogicalConnective | AtomicPredicate): Address {
    if (operator == LogicalConnective.Not) {
      return NotDeciderAddress
    } else if (operator == LogicalConnective.And) {
      return AndDeciderAddress
    } else if (operator == LogicalConnective.ForAllSuchThat) {
      return ForAllSuchThatDeciderAddress
    } else if (operator == LogicalConnective.Or) {
      return OrDeciderAddress
    } else if (operator == AtomicPredicate.Bool) {
      return BoolDeciderAddress
    } else {
      throw new Error(`operator ${operator} is not registered.`)
    }
  }
  async getStorageDb(): Promise<KeyValueStore> {
    return this.db
  }
  isDecompiledProperty(property: Property) {
    return false
  }
  decompile(property: Property) {
    return null
  }
}
