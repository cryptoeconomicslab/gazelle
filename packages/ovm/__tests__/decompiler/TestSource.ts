export const testSource = `@library
@quantifier("range,NUMBER,\${zero}-\${upper_bound}")
def LessThan(n: BigNumber, upper_bound: BigNumber) :=
  IsLessThan(n, upper_bound)
    
def test(a: BigNumber) := LessThan(a).all(b -> Bool(b) and Bool(b))
`

export const OWNERSHIP_SOURCE = `
@library
@quantifier("signatures,KEY,\${m}")
def SignedBy(sig: Bytes, m: Bytes, signer: Address) := IsValidSignature(m, sig, signer, $secp256k1)
def ownership(owner: Address, tx: Property) := SignedBy(tx, owner).any()
`

export const STATEUPDATE_SOURCE = `
@library
def IsValidTx(tx: Property, token: Address, range: Range, block_number: BigNumber) :=
  Equal(tx.address, $txAddress)
  and Equal(tx.0, token)
  and HasIntersection(range, tx.1)
  and IsLessThan(block_number, tx.2)

@library
@quantifier("tx.block\${b}.range\${token},RANGE,\${range}")
def Tx(tx: Property, token: Address, range: Range, b: BigNumber) :=
  IsValidTx(tx, token, range, b)

def stateUpdate(token: Address, range: Range, block_number: BigNumber, so: Property) :=
  Tx(token, range, block_number).any(tx ->
    so(tx)
  )
`

export const CHECKPOINT_SOURCE = `
@library
@quantifier("stored.\${contract},KEY,\${key}")
def Stored(value: Bytes, contract: Address, key: Bytes) := IsStored(contract, key, value)

@library
@quantifier("proof.block\${b}.range\${token},RANGE,\${range}")
def IncludedAt(proof: Bytes, leaf: Bytes, token: Address, range: Range, b: BigNumber, commitmentContract: Address) :=
  Stored(commitmentContract, b).any(root ->
    VerifyInclusion(leaf, token, range, proof, root)
  )

@library
@quantifier("range,NUMBER,\${zero}-\${upper_bound}")
def LessThan(n: BigNumber, upper_bound: BigNumber) :=
  IsLessThan(n, upper_bound)

@library
@quantifier("su.block\${b}.range\${token},RANGE,\${range}")
def SU(su: Property, token: Address, range: Range, b: BigNumber) :=
  IncludedAt(su.3, token, range, b, $commitmentContract).any()

def checkpoint(su: Property, proof: Bytes) :=
  Stored($commitmentContract, su.2).any(root ->
    VerifyInclusion(su.3, su.0, su.1, proof, root)
  )
  and LessThan(su.2).all(b -> 
    SU(su.0, su.1, b).all(old_su -> old_su())
  )
`

export const EXIT_DEPOSIT_SOURCE = `
def exitDeposit(su: Property, checkpoint: Property) := !su()
`

export const EXIT_SOURCE = `
def exit(su: Property, proof: Bytes) := !su() and Checkpoint(su, proof)
`
