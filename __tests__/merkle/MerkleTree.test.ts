import { DoubleLayerTree } from 'merkle-tree-wasm/merkle_tree_wasm'
import { constants } from 'ethers'

function createLeaf(address: string, data: string, end: number) {
  return {
    data,
    end,
    address
  }
}

describe('MerkleTree', () => {
  it('verify 2 leaves', async () => {
    const ethAddress = constants.AddressZero.substr(2)
    const leaf1 = createLeaf(ethAddress, '00', 10)
    const leaf2 = createLeaf(ethAddress, '01', 20)
    const tree = DoubleLayerTree.generate([leaf1, leaf2])
    const root = tree.get_root()
    const inclusionProof = tree.get_inclusion_proof(ethAddress, 0)
    expect(DoubleLayerTree.verify(leaf1, inclusionProof, root)).toEqual(true)
  })
  it('verify 3 leaves', async () => {
    const ethAddress = constants.AddressZero.substr(2)
    const leaf1 = createLeaf(ethAddress, '00', 10)
    const leaf2 = createLeaf(ethAddress, '01', 20)
    const leaf3 = createLeaf(ethAddress, '02', 1000)
    const tree = DoubleLayerTree.generate([leaf1, leaf2, leaf3])
    const root = tree.get_root()
    const inclusionProof = tree.get_inclusion_proof(ethAddress, 1)
    expect(DoubleLayerTree.verify(leaf2, inclusionProof, root)).toEqual(true)
  })
  it('fail to verify 3 leaves', async () => {
    const ethAddress = constants.AddressZero.substr(2)
    const leaf1 = createLeaf(ethAddress, '00', 10)
    const leaf2 = createLeaf(ethAddress, '01', 20)
    const leaf3 = createLeaf(ethAddress, '02', 1000)
    const tree = DoubleLayerTree.generate([leaf1, leaf2, leaf3])
    const root = tree.get_root()
    const inclusionProof = tree.get_inclusion_proof(ethAddress, 1)
    expect(DoubleLayerTree.verify(leaf3, inclusionProof, root)).toEqual(false)
  })
  it('catch exception of verify', async () => {
    const ethAddress = constants.AddressZero.substr(2)
    const leaf1 = createLeaf(ethAddress, '00', 10)
    const leaf2 = createLeaf(ethAddress, '01', 20)
    const leaf3 = createLeaf(ethAddress, '02', 1000)
    const tree = DoubleLayerTree.generate([leaf1, leaf2, leaf3])
    const root = tree.get_root()
    expect(() => {
      DoubleLayerTree.verify(leaf1, 'dammy', root)
    }).toThrow()
  })
})
