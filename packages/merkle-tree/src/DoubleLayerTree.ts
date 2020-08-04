import {
  Bytes,
  Address,
  BigNumber,
  Range,
  Struct,
  FixedBytes
} from '@cryptoeconomicslab/primitives'
import {
  MerkleTreeInterface,
  MerkleTreeGenerator,
  MerkleTreeNode
} from './MerkleTreeInterface'
import {
  AddressTree,
  AddressTreeNode,
  AddressTreeVerifier,
  AddressTreeInclusionProof
} from './AddressTree'
import {
  IntervalTree,
  IntervalTreeNode,
  IntervalTreeVerifier,
  IntervalTreeInclusionProof
} from './IntervalTree'
import JSBI from 'jsbi'

export class DoubleLayerInclusionProof {
  constructor(
    readonly intervalInclusionProof: IntervalTreeInclusionProof,
    readonly addressInclusionProof: AddressTreeInclusionProof
  ) {}

  public toStruct(): Struct {
    return new Struct([
      {
        key: 'addressInclusionProof',
        value: this.addressInclusionProof.toStruct()
      },
      {
        key: 'intervalInclusionProof',
        value: this.intervalInclusionProof.toStruct()
      }
    ])
  }

  public static fromStruct(s: Struct): DoubleLayerInclusionProof {
    return new DoubleLayerInclusionProof(
      IntervalTreeInclusionProof.fromStruct(s.data[1].value as Struct),
      AddressTreeInclusionProof.fromStruct(s.data[0].value as Struct)
    )
  }

  public static getParamType(): Struct {
    return new Struct([
      {
        key: 'addressInclusionProof',
        value: AddressTreeInclusionProof.getParamType()
      },
      {
        key: 'intervalInclusionProof',
        value: IntervalTreeInclusionProof.getParamType()
      }
    ])
  }
}

export interface DoubleLayerInterval {
  address: Address
  start: BigNumber
}

export class DoubleLayerTreeLeaf
  implements MerkleTreeNode<DoubleLayerInterval> {
  constructor(
    public address: Address,
    public start: BigNumber,
    public data: FixedBytes
  ) {}
  encode(): Bytes {
    return ovmContext.coder.encode(this.toStruct())
  }

  getData(): FixedBytes {
    return this.data
  }
  getInterval() {
    return {
      address: this.address,
      start: this.start
    }
  }

  public static getParamType(): Struct {
    return new Struct([
      { key: 'address', value: Address.default() },
      { key: 'start', value: BigNumber.default() },
      { key: 'data', value: FixedBytes.default(32) }
    ])
  }

  public toStruct(): Struct {
    return new Struct([
      {
        key: 'address',
        value: this.address
      },
      {
        key: 'start',
        value: this.start
      },
      {
        key: 'data',
        value: this.data
      }
    ])
  }

  public static fromStruct(struct: Struct): DoubleLayerTreeLeaf {
    return new DoubleLayerTreeLeaf(
      struct.data[0].value as Address,
      struct.data[1].value as BigNumber,
      struct.data[2].value as FixedBytes
    )
  }
}

export class DoubleLayerTreeGenerator
  implements MerkleTreeGenerator<DoubleLayerInterval, DoubleLayerTreeLeaf> {
  generate(leaves: DoubleLayerTreeLeaf[]): DoubleLayerTree {
    if (leaves.length == 0) {
      throw new Error('leaves must not be empty.')
    }
    return new DoubleLayerTree(leaves)
  }
}

/**
 * DoubleLayerTree class
 *     This class construct double layer tree which has 2 layers.
 *     The 1st layer is address tree and 2nd layer is interval tree.
 *     Please see https://docs.plasma.group/projects/spec/en/latest/src/01-core/double-layer-tree.html
 */
export class DoubleLayerTree
  implements MerkleTreeInterface<DoubleLayerInterval, DoubleLayerTreeLeaf> {
  addressTree: AddressTree
  intervalTreeMap: Map<string, IntervalTree> = new Map<string, IntervalTree>()
  constructor(private leaves: DoubleLayerTreeLeaf[]) {
    // check if the leaves is in order of address
    const sorted = leaves.reduce((sorted, current, currentIndex, array) => {
      if (!sorted) return false

      // last element
      if (currentIndex === array.length - 1) return sorted
      const next = array[currentIndex + 1]

      return (
        (current.address.data === next.address.data &&
          JSBI.lessThan(current.start.data, next.start.data)) ||
        current.address.data < next.address.data
      )
    }, true)
    if (!sorted) throw new Error('Invalid ordered leaves')

    // get ordered unique addresses' string
    const addresses = leaves
      .map(leaf => leaf.address.data)
      .filter((v, i, a) => a.indexOf(v) === i)

    const addressTreeLeaves: AddressTreeNode[] = []
    const addressLeavesMap = leaves.reduce<Map<string, IntervalTreeNode[]>>(
      (newMap, l) => {
        let map = newMap.get(l.address.data)
        if (!map) {
          map = []
        }
        map.push(new IntervalTreeNode(l.start, l.data))
        newMap.set(l.address.data, map)
        return newMap
      },
      new Map<string, IntervalTreeNode[]>()
    )

    for (const key of addresses) {
      const value = addressLeavesMap.get(key) as IntervalTreeNode[]
      const intervalTree = new IntervalTree(value)
      this.intervalTreeMap.set(key, intervalTree)
      addressTreeLeaves.push(
        new AddressTreeNode(Address.from(key), intervalTree.getRoot())
      )
    }
    this.addressTree = new AddressTree(addressTreeLeaves)
  }
  getRoot(): FixedBytes {
    return this.addressTree.getRoot()
  }
  findIndexByInterval(interval: BigNumber): number | null {
    const foundIndex = this.leaves.findIndex(l => l.start.equals(interval))
    return foundIndex >= 0 ? foundIndex : null
  }
  findIndex(leaf: FixedBytes): number | null {
    const foundIndex = this.leaves.findIndex(
      l => l.getData().toHexString() == leaf.toHexString()
    )
    return foundIndex >= 0 ? foundIndex : null
  }
  getLeaf(index: number): DoubleLayerTreeLeaf {
    throw new Error('not implemented')
  }
  getLeaves(address: Address, start: JSBI, end: JSBI): number[] {
    const tree = this.intervalTreeMap.get(address.data)
    if (tree) {
      return tree.getLeaves(start, end)
    }
    throw new Error('address not found in address tree')
  }
  getInclusionProofByAddressAndIndex(
    address: Address,
    index: number
  ): DoubleLayerInclusionProof {
    const addressTreeIndex = this.addressTree.getIndexByAddress(address)
    if (addressTreeIndex !== null) {
      const addressInclusionProof = this.addressTree.getInclusionProof(
        addressTreeIndex
      )
      const intervalTree = this.intervalTreeMap.get(address.data)
      if (intervalTree) {
        const intervalInclusionProof = intervalTree.getInclusionProof(index)
        return new DoubleLayerInclusionProof(
          intervalInclusionProof,
          addressInclusionProof
        )
      }
    }
    throw new Error('address not found in address tree')
  }
}

export interface DoubleLayerTreeVerifier {
  verifyInclusion(
    leaf: DoubleLayerTreeLeaf,
    range: Range,
    root: FixedBytes,
    inclusionProof: DoubleLayerInclusionProof
  ): boolean
}

/**
 * DoubleLayerTreeVerifier is the class to verify inclusion of Double Layer Tree.
 */
export class DoubleLayerTreeVerifier implements DoubleLayerTreeVerifier {
  /**
   * verifyInclusion verify leaf data is included or not in specific range.
   * @param leaf The leaf to verify
   * @param range The range to verify it within implicit range
   * @param root The merkle root of tree
   * @param inclusionProof proof data to verify inclusion
   */
  verifyInclusion(
    leaf: DoubleLayerTreeLeaf,
    range: Range,
    root: FixedBytes,
    inclusionProof: DoubleLayerInclusionProof
  ): boolean {
    const intervalTreeVerifier = new IntervalTreeVerifier()
    const addressTreeVerifier = new AddressTreeVerifier()
    const intervalNode = new IntervalTreeNode(leaf.start, leaf.data)

    const merklePath = intervalTreeVerifier.calculateMerklePath(
      inclusionProof.intervalInclusionProof
    )
    const computeIntervalRootAndEnd = intervalTreeVerifier.computeRootFromInclusionProof(
      intervalNode,
      merklePath,
      inclusionProof.intervalInclusionProof.siblings
    )
    if (
      JSBI.lessThan(
        computeIntervalRootAndEnd.implicitEnd.data,
        range.end.data
      ) ||
      JSBI.lessThan(range.start.data, leaf.start.data)
    ) {
      throw new Error('required range must not exceed the implicit range')
    }
    return addressTreeVerifier.verifyInclusion(
      new AddressTreeNode(leaf.address, computeIntervalRootAndEnd.root),
      leaf.address,
      leaf.address,
      root,
      inclusionProof.addressInclusionProof
    )
  }
}
