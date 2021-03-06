pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import { DataTypes as types } from "ovm-contracts/DataTypes.sol";
import "ovm-contracts/UniversalAdjudicationContract.sol";
import "ovm-contracts/Utils.sol";
import "ovm-contracts/AtomicPredicate.sol";
import "ovm-contracts/CompiledPredicate.sol";


/**
 * ForallTest(a)
 */
contract ForallTest {
    bytes public ForallTestF = bytes("ForallTestF");

    UniversalAdjudicationContract adjudicationContract;
    Utils utils;
    address IsLessThan;
    address Equal;
    address IsValidSignature;
    address IsContained;
    address HasIntersection;
    address VerifyInclusion;
    address IsSameAmount;
    address IsConcatenatedWith;
    address IsValidHash;
    address IsStored;
    address notAddress;
    address andAddress;
    address forAllSuchThatAddress;
    address public payoutContractAddress;
    bool isInitialized = false;

    constructor(
        address _adjudicationContractAddress,
        address _utilsAddress,
        address _notAddress,
        address _andAddress,
        address _forAllSuchThatAddress
    ) public {
        adjudicationContract = UniversalAdjudicationContract(_adjudicationContractAddress);
        utils = Utils(_utilsAddress);
        notAddress = _notAddress;
        andAddress = _andAddress;
        forAllSuchThatAddress = _forAllSuchThatAddress;
    }

    function setPredicateAddresses(
        address _isLessThan,
        address _equal,
        address _isValidSignature,
        address _isContained,
        address _hasIntersection,
        address _verifyInclusion,
        address _isSameAmount,
        address _isConcatenatedWith,
        address _isValidHash,
        address _isStored,
        address _payoutContractAddress
    ) public {
        require(!isInitialized, "isInitialized must be false");
        IsLessThan = _isLessThan;
        Equal = _equal;
        IsValidSignature = _isValidSignature;
        IsContained = _isContained;
        HasIntersection = _hasIntersection;
        VerifyInclusion = _verifyInclusion;
        IsSameAmount = _isSameAmount;
        IsConcatenatedWith = _isConcatenatedWith;
        IsValidHash = _isValidHash;
        IsStored = _isStored;
        payoutContractAddress = _payoutContractAddress;
        isInitialized = true;
    }
    
    /**
     * @dev Validates a child node of the property in game tree.
     */
    function isValidChallenge(
        bytes[] memory _inputs,
        bytes[] memory _challengeInput,
        types.Property memory _challenge
    ) public view returns (bool) {
        require(
            keccak256(abi.encode(getChild(_inputs, _challengeInput))) == keccak256(abi.encode(_challenge)),
            "_challenge must be valud child of game tree"
        );
        return true;
    }
    
    function getChild(
        bytes[] memory inputs,
        bytes[] memory challengeInput
    ) private view returns (types.Property memory) {
        if(!utils.isLabel(inputs[0])) {
            return getChildForallTestF(inputs, challengeInput);
        }
        bytes32 input0 = keccak256(utils.getInputValue(inputs[0]));
        bytes[] memory subInputs = utils.subArray(inputs, 1, inputs.length);
        if(input0 == keccak256(ForallTestF)) {
            return getChildForallTestF(subInputs, challengeInput);
        }
    }



    /**
     * Gets child of ForallTestF(ForallTestF,a).
     */
    function getChildForallTestF(bytes[] memory _inputs, bytes[] memory challengeInputs) private view returns (types.Property memory) {
        bytes[] memory notInputs = new bytes[](1);
        bytes[] memory childInputsOf = new bytes[](1);
        childInputsOf[0] = challengeInputs[0];

        notInputs[0] = abi.encode(types.Property({
            predicateAddress: Foo,
            inputs: childInputsOf
        }));

        return types.Property({
            predicateAddress: notAddress,
            inputs: notInputs
        });
    }

}

