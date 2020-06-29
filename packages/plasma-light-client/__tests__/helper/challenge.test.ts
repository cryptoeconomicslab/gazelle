import { setupContext } from '@cryptoeconomicslab/context'
import JsonCoder from '@cryptoeconomicslab/coder'
import { Address, Bytes, Property } from '@cryptoeconomicslab/primitives'
import { executeChallenge } from '../../src/helper/challenge'
import { Challenge } from '@cryptoeconomicslab/ovm'
setupContext({ coder: JsonCoder })

const mockClaimProperty = jest.fn()
const mockIsDecided = jest.fn().mockResolvedValue(true)
const mockIsDecidable = jest.fn().mockResolvedValue(true)
const mockDecideClaimToFalse = jest.fn()
const mockDecideClaimToTrue = jest.fn()
const mockChallenge = jest.fn()
const mockGetClaimedProperties = jest.fn().mockResolvedValue([])
const mockDecideClaimWithWitness = jest.fn()

const MockAdjudicationContract = jest.fn().mockImplementation(() => {
  return {
    isDecided: mockIsDecided,
    isDecidable: mockIsDecidable,
    decideClaimToTrue: mockDecideClaimToTrue,
    decideClaimToFalse: mockDecideClaimToFalse,
    challenge: mockChallenge,
    claimProperty: mockClaimProperty,
    getClaimedProperties: mockGetClaimedProperties,
    decideClaimWithWitness: mockDecideClaimWithWitness
  }
})

const witnesses = [Bytes.default()]
const MockDeciderManager = jest.fn().mockImplementation(() => {
  return {
    decide: jest.fn().mockResolvedValue({ outcome: true, witnesses })
  }
})

const MockDeciderManagerFalse = jest.fn().mockImplementation(() => {
  return {
    decide: jest.fn().mockResolvedValue({ outcome: false })
  }
})

describe('challenge', () => {
  const property = new Property(Address.default(), [
    Bytes.fromHexString('0x01')
  ])
  const challenge: Challenge = {
    property: new Property(Address.default(), []),
    challengeInputs: [Bytes.default()]
  }

  beforeEach(async () => {
    MockAdjudicationContract.mockClear()
    mockClaimProperty.mockClear()
    mockDecideClaimToFalse.mockClear()
    mockChallenge.mockClear()
    mockDecideClaimWithWitness.mockClear()
    mockDecideClaimToFalse.mockClear()
  })

  describe('executeChallenge', () => {
    test('executeChallenge calls decideClaimWithWitness', async () => {
      await executeChallenge(
        new MockAdjudicationContract(),
        new MockDeciderManager(),
        property,
        challenge
      )
      expect(mockClaimProperty).toHaveBeenCalled()
      expect(mockChallenge).toHaveBeenCalled()
      expect(mockDecideClaimWithWitness).toHaveBeenCalledWith(
        challenge.property,
        witnesses
      )
      expect(mockDecideClaimToFalse).toHaveBeenCalledWith(
        property,
        challenge.property
      )
    })

    test("executeChallenge doesn't calls decideClaimWithWitness", async () => {
      await executeChallenge(
        new MockAdjudicationContract(),
        new MockDeciderManagerFalse(),
        property,
        challenge
      )
      expect(mockClaimProperty).toHaveBeenCalled()
      expect(mockChallenge).toHaveBeenCalled()
      expect(mockDecideClaimWithWitness).not.toHaveBeenCalled()
      expect(mockDecideClaimToFalse).not.toHaveBeenCalled()
    })
  })
})
